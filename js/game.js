"use strict";

/* =========================================================
   Utilitaires
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function hashHue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(name) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
// Logos de séries : img/series/<série>.png (facultatifs, chargés au démarrage)
const seriesSrc = new Map();
function emblem(series, cls = "emblem") {
  const src = seriesSrc.get(series);
  return src ? `<img class="${cls}" src="${src}" alt="" title="${esc(series)}">` : "";
}
function badge(f) {
  const h = hashHue(f.series);
  const inner = emblem(f.series, "badge-emblem") || esc(initials(f.name));
  return `<span class="badge" style="background:linear-gradient(135deg,hsl(${h} 65% 45%),hsl(${(h + 40) % 360} 70% 30%))">${inner}</span>`;
}
function valueHtml(f, key) {
  const text = `<span>${esc(displayValue(f, key))}</span>`;
  return key === "series" ? emblem(f.series, "value-emblem") + text : text;
}

const store = {
  get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* stockage indisponible */ } },
};

/* =========================================================
   Réglages, stats, pool de combattants
   ========================================================= */
const SETTINGS_KEY = "smash2le-settings-v1";
const STATS_KEY = "smash2le-stats-v1";

const settings = Object.assign({ games: [1, 2, 3, 4, 5], origin: "all", hardcore: false }, store.get(SETTINGS_KEY, {}));
const stats = store.get(STATS_KEY, {});
const saveSettings = () => store.set(SETTINGS_KEY, settings);
const saveStats = () => store.set(STATS_KEY, stats);

function modeStats(mode) {
  if (!stats[mode]) stats[mode] = { played: 0, wins: 0, streak: 0, best: 0, dist: {}, highScore: 0 };
  return stats[mode];
}
function recordRound(mode, won, tries) {
  const s = modeStats(mode);
  s.played++;
  if (won) {
    s.wins++; s.streak++; s.best = Math.max(s.best, s.streak);
    s.dist[tries] = (s.dist[tries] || 0) + 1;
  } else s.streak = 0;
  saveStats();
}
function recordScore(mode, score) {
  const s = modeStats(mode);
  s.played++;
  const isRecord = score > s.highScore;
  s.highScore = Math.max(s.highScore, score);
  saveStats();
  return isRecord;
}

function pool() {
  let p = FIGHTERS.filter((f) => settings.games.includes(f.smash));
  if (settings.origin !== "all") p = p.filter((f) => f.origin === settings.origin);
  return p.length >= 3 ? p : FIGHTERS;
}

// Sac mélangé : on voit tout le pool avant de revoir un combattant.
let bag = [];
let lastTarget = null;
const bags = {};
function nextTarget(key = "main", p = pool()) {
  let bag = (bags[key] || []).filter((f) => p.includes(f));
  if (!bag.length) {
    bag = shuffle([...p]);
    if (bag.length > 1 && bag[bag.length - 1] === lastTarget) bag.unshift(bag.pop());
  }
  lastTarget = bag.pop();
  bags[key] = bag;
  return lastTarget;
}

/* =========================================================
   Images fournies par l'utilisateur (mode Silhouette)
   img/fighters/<nom>.png  (nom = nom du combattant en minuscules, sans accents ni espaces)
   ========================================================= */
const IMG_DIR = "img/fighters/";
const IMG_EXTS = ["png", "webp", "jpg", "jpeg"];
const imageSrc = new Map();
let imagesProbe = null;

const imgSlug = (s) => norm(s);
const canLoad = (src) => new Promise((resolve) => {
  const i = new Image();
  i.onload = () => resolve(true);
  i.onerror = () => resolve(false);
  i.src = src;
});
function probeImages(force = false) {
  if (imagesProbe && !force) return imagesProbe;
  imageSrc.clear();
  const bust = force ? `?t=${Date.now()}` : "";
  imagesProbe = Promise.all(FIGHTERS.map(async (f) => {
    const bases = [...new Set([f.name, ...f.aliases.slice(0, 2)].map(imgSlug))];
    for (const base of bases) {
      for (const ext of IMG_EXTS) {
        const src = `${IMG_DIR}${base}.${ext}`;
        if (await canLoad(src + bust)) { imageSrc.set(f.id, src + bust); return; }
      }
    }
  }));
  return imagesProbe;
}

/* =========================================================
   Comparaison (mode Classique)
   ========================================================= */
const COLUMNS = [
  { key: "gender", label: "Genre" },
  { key: "species", label: "Espèce" },
  { key: "series", label: "Série" },
  { key: "origin", label: "Éditeur" },
  { key: "smash", label: "1er Smash" },
  { key: "year", label: "1re apparition" },
];

function compare(guess, target, hardcore) {
  const out = {};
  const g = guess, t = target;

  // Genre : "Plusieurs" contient Homme et Femme
  if (g.gender === t.gender) out.gender = "ok";
  else if ((g.gender === "Plusieurs" && ["Homme", "Femme"].includes(t.gender)) ||
           (t.gender === "Plusieurs" && ["Homme", "Femme"].includes(g.gender))) out.gender = "partial";
  else out.gender = "ko";

  // Espèce : Humain ~ Humanoïde
  const humanish = ["Humain", "Humanoïde"];
  if (g.species === t.species) out.species = "ok";
  else if (humanish.includes(g.species) && humanish.includes(t.species)) out.species = "partial";
  else out.species = "ko";

  // Série : même groupe de séries => partiel
  if (g.series === t.series) out.series = "ok";
  else if (SERIES_GROUPS[g.series] && SERIES_GROUPS[g.series] === SERIES_GROUPS[t.series]) out.series = "partial";
  else out.series = "ko";

  out.origin = g.origin === t.origin ? "ok" : "ko";

  out.smash = g.smash === t.smash ? "ok" : "ko";
  out.smashDir = g.smash < t.smash ? "up" : g.smash > t.smash ? "down" : "";

  const dy = Math.abs(g.year - t.year);
  out.year = dy === 0 ? "ok" : dy <= 3 ? "partial" : "ko";
  out.yearDir = g.year < t.year ? "up" : g.year > t.year ? "down" : "";

  if (hardcore) {
    for (const c of COLUMNS) if (out[c.key] === "partial") out[c.key] = "ko";
    out.smashDir = out.yearDir = "";
  }
  return out;
}

function displayValue(f, key) {
  if (key === "smash") return SMASH_GAMES[f.smash];
  return f[key];
}

/* =========================================================
   Champ de saisie avec autocomplétion
   ========================================================= */
function makeGuessInput({ exclude, onPick, placeholder = "Tape le nom d'un combattant…" }) {
  const box = el("div", "guess-box");
  const input = el("input");
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  const btn = el("button", "btn", "Valider");
  const list = el("div", "suggest");
  list.hidden = true;
  box.append(input, btn, list);

  let matches = [];
  let sel = 0;

  function search(q) {
    const n = norm(q);
    if (!n) return [];
    const excluded = exclude();
    const scored = [];
    for (const f of pool()) {
      if (excluded.has(f.id)) continue;
      const names = [f.name, ...f.aliases].map(norm);
      let score = -1;
      for (const nm of names) {
        if (nm.startsWith(n)) score = Math.max(score, 2);
        else if (nm.includes(n)) score = Math.max(score, 1);
      }
      if (score >= 0) scored.push({ f, score });
    }
    scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name, "fr"));
    return scored.map((s) => s.f);
  }

  function render() {
    list.innerHTML = "";
    if (!matches.length) { list.hidden = true; return; }
    matches.forEach((f, i) => {
      const row = el("div", i === sel ? "sel" : "", `${badge(f)}<span>${esc(f.name)}</span><small>${esc(f.series)}</small>`);
      row.addEventListener("mousedown", (e) => { e.preventDefault(); pick(f); });
      list.append(row);
    });
    list.hidden = false;
    const s = list.children[sel];
    if (s) s.scrollIntoView({ block: "nearest" });
  }

  function pick(f) {
    if (!f) return;
    input.value = "";
    matches = [];
    render();
    onPick(f);
  }

  input.addEventListener("input", () => { matches = search(input.value); sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (matches.length) { sel = (sel + 1) % matches.length; render(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (matches.length) { sel = (sel - 1 + matches.length) % matches.length; render(); } }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); pick(matches[sel]); }
    else if (e.key === "Escape") { matches = []; render(); }
  });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 100));
  input.addEventListener("focus", () => { if (input.value) { matches = search(input.value); render(); } });
  btn.addEventListener("click", () => pick(matches[sel]));

  return {
    node: box,
    focus: () => input.focus(),
    disable: () => { input.disabled = true; btn.disabled = true; list.hidden = true; },
  };
}

/* =========================================================
   Composants d'affichage partagés
   ========================================================= */
function classicGrid(guesses, target, hardcore) {
  const wrap = el("div", "grid-wrap");
  const grid = el("div", "grid");
  const head = el("div", "grid-row grid-head");
  head.append(el("div", "", "Combattant"));
  COLUMNS.forEach((c) => head.append(el("div", "", c.label)));
  grid.append(head);

  // Le plus récent en haut
  [...guesses].reverse().forEach((g, idx) => {
    const res = compare(g, target, hardcore);
    const row = el("div", "grid-row");
    const fresh = idx === 0;
    const nameCell = el("div", "cell name", `${badge(g)}<span>${esc(g.name)}</span>`);
    if (!fresh) nameCell.style.animation = "none";
    row.append(nameCell);
    COLUMNS.forEach((c, i) => {
      const dir = c.key === "smash" ? res.smashDir : c.key === "year" ? res.yearDir : "";
      const arrow = dir ? `<span class="arrow ${dir}"></span>` : "";
      const cell = el("div", `cell ${res[c.key]}`, `<div class="cell-inner">${valueHtml(g, c.key)}${arrow}</div>`);
      if (fresh) cell.style.animationDelay = `${(i + 1) * 0.12}s`;
      else cell.style.animation = "none";
      row.append(cell);
    });
    grid.append(row);
  });
  wrap.append(grid);
  return wrap;
}

function legend(hardcore) {
  const l = el("div", "legend");
  l.innerHTML = `<span style="--c:var(--ok)">Correct</span>` +
    (hardcore ? "" : `<span style="--c:var(--partial)">Proche</span>`) +
    `<span style="--c:var(--ko)">Faux</span>` +
    (hardcore ? "" : `<span style="--c:transparent">▲ ▼ plus récent / plus ancien</span>`);
  return l;
}

function wrongList(guesses) {
  const w = el("div", "wrong-list");
  [...guesses].reverse().forEach((g) => w.append(el("div", "wrong", `${badge(g)}<span>${esc(g.name)}</span>`)));
  return w;
}

function hud(chips) {
  const h = el("div", "hud");
  chips.forEach(([label, value, cls = ""]) => h.append(el("div", `chip ${cls}`, `${label} <b>${value}</b>`)));
  return h;
}

function resultPanel({ won, target, lines = [], actions }) {
  const r = el("div", `result ${won ? "" : "lose"}`);
  r.innerHTML = `<h2>${won ? "GG ! 🎉" : "Raté…"}</h2>
    <div>${won ? "C'était bien" : "La réponse était"}</div>
    <div class="answer">${badge(target)}<span>${esc(target.name)}</span></div>
    ${lines.map((l) => `<p>${l}</p>`).join("")}`;
  const a = el("div", "actions");
  actions.forEach(({ label, cls = "btn", onClick, kbd }) => {
    const b = el("button", cls, label + (kbd ? `<span class="kbd">(${kbd})</span>` : ""));
    b.addEventListener("click", onClick);
    a.append(b);
  });
  r.append(a);
  return r;
}

/* =========================================================
   Modes de jeu
   ========================================================= */
const game = $("#game");
let current = null;     // mode actif
let onEnter = null;     // action de la touche Entrée quand une manche est finie

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && onEnter && $("#modal").hidden) {
    e.preventDefault();
    const fn = onEnter; onEnter = null; fn();
  }
});

/* ---------- Classique ---------- */
const Classic = {
  id: "classic",
  start() {
    this.target = nextTarget();
    this.guesses = [];
    this.over = false;
    this.hardcore = settings.hardcore;
    this.max = this.hardcore ? 6 : Infinity;
    this.render();
  },
  render() {
    onEnter = null;
    game.innerHTML = "";
    const s = modeStats("classic");
    game.append(hud([
      ["Essais", this.max === Infinity ? this.guesses.length : `${this.guesses.length} / ${this.max}`],
      ["Série", s.streak, "hot"],
      ["Record", s.best],
      ...(this.hardcore ? [["Mode", "Hardcore", "danger"]] : []),
    ]));
    if (this.over) {
      const won = this.won;
      game.append(resultPanel({
        won, target: this.target,
        lines: won ? [`Trouvé en <b>${this.guesses.length}</b> essai${this.guesses.length > 1 ? "s" : ""}.`] : [],
        actions: [{ label: "Combattant suivant", cls: "btn gold", kbd: "Entrée", onClick: () => this.start() }],
      }));
      onEnter = () => this.start();
    } else {
      game.append(el("p", "prompt", "Quel combattant de Smash se cache derrière ces indices ?"));
      const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
      game.append(input.node);
      if (this.guesses.length) {
        const gu = el("button", "btn ghost give-up", "Abandonner");
        gu.addEventListener("click", () => this.finish(false));
        game.append(gu);
      }
      input.focus();
    }
    if (this.guesses.length) game.append(classicGrid(this.guesses, this.target, this.hardcore));
    game.append(legend(this.hardcore));
  },
  guess(f) {
    this.guesses.push(f);
    if (f === this.target) return this.finish(true);
    if (this.guesses.length >= this.max) return this.finish(false);
    this.render();
  },
  finish(won) {
    this.over = true;
    this.won = won;
    recordRound("classic", won, this.guesses.length);
    this.render();
  },
};

/* ---------- Énigme : attributs révélés un par un ---------- */
const ENIGME_ORDER = [
  { key: "year", label: "1re apparition" },
  { key: "smash", label: "1er Smash" },
  { key: "species", label: "Espèce" },
  { key: "gender", label: "Genre" },
  { key: "origin", label: "Éditeur" },
  { key: "series", label: "Série" },
];
const Enigme = {
  id: "enigme",
  maxGuesses: 8,
  start() {
    this.target = nextTarget();
    this.guesses = [];
    this.over = false;
    this.render();
  },
  revealed() { return Math.min(ENIGME_ORDER.length, 1 + this.guesses.length); },
  render() {
    onEnter = null;
    game.innerHTML = "";
    const s = modeStats("enigme");
    game.append(hud([
      ["Essais", `${this.guesses.length} / ${this.maxGuesses}`],
      ["Indices", `${this.over ? ENIGME_ORDER.length : this.revealed()} / ${ENIGME_ORDER.length}`],
      ["Série", s.streak, "hot"],
      ["Record", s.best],
    ]));
    game.append(el("p", "prompt", "Chaque erreur révèle un nouvel indice. Trouve-le avec le moins d'indices possible !"));
    const clues = el("div", "clues");
    const shown = this.over ? ENIGME_ORDER.length : this.revealed();
    ENIGME_ORDER.forEach((c, i) => {
      const on = i < shown;
      const fresh = !this.over && i === shown - 1;
      clues.append(el("div", `clue ${on ? (fresh ? "revealed" : "") : "hidden"}`,
        `<small>${c.label}</small><b>${on ? valueHtml(this.target, c.key) : "???"}</b>`));
    });
    game.append(clues);
    if (this.over) {
      const won = this.won;
      game.append(resultPanel({
        won, target: this.target,
        lines: won ? [`Trouvé avec <b>${this.revealed()}</b> indice${this.revealed() > 1 ? "s" : ""} en <b>${this.guesses.length}</b> essai${this.guesses.length > 1 ? "s" : ""}.`] : [],
        actions: [{ label: "Énigme suivante", cls: "btn gold", kbd: "Entrée", onClick: () => this.start() }],
      }));
      onEnter = () => this.start();
    } else {
      const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
      game.append(input.node);
      input.focus();
    }
    game.append(wrongList(this.guesses.filter((g) => g !== this.target)));
  },
  guess(f) {
    this.guesses.push(f);
    if (f === this.target) return this.finish(true);
    if (this.guesses.length >= this.maxGuesses) return this.finish(false);
    this.render();
  },
  finish(won) {
    this.over = true;
    this.won = won;
    recordRound("enigme", won, this.guesses.length);
    this.render();
  },
};

/* ---------- Emoji ---------- */
const Emoji = {
  id: "emoji",
  maxGuesses: 7,
  start() {
    this.target = nextTarget();
    // 4 emojis tirés au hasard dans la réserve du combattant, dans un ordre aléatoire
    this.emojis = shuffle([...this.target.emoji]).slice(0, 4);
    this.guesses = [];
    this.over = false;
    this.render();
  },
  revealed() { return Math.min(4, 1 + this.guesses.length); },
  render() {
    onEnter = null;
    game.innerHTML = "";
    const s = modeStats("emoji");
    game.append(hud([
      ["Essais", `${this.guesses.length} / ${this.maxGuesses}`],
      ["Série", s.streak, "hot"],
      ["Record", s.best],
    ]));
    game.append(el("p", "prompt", "Quel combattant ces emojis décrivent-ils ?"));
    const row = el("div", "emojis");
    const shown = this.over ? 4 : this.revealed();
    this.emojis.forEach((e, i) => {
      row.append(i < shown ? el("div", "emoji-slot on", e) : el("div", "emoji-slot off", "?"));
    });
    game.append(row);
    if (this.over) {
      const won = this.won;
      game.append(resultPanel({
        won, target: this.target,
        lines: won ? [`Trouvé en <b>${this.guesses.length}</b> essai${this.guesses.length > 1 ? "s" : ""}.`] : [],
        actions: [{ label: "Suivant", cls: "btn gold", kbd: "Entrée", onClick: () => this.start() }],
      }));
      onEnter = () => this.start();
    } else {
      const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
      game.append(input.node);
      input.focus();
    }
    game.append(wrongList(this.guesses.filter((g) => g !== this.target)));
  },
  guess(f) {
    this.guesses.push(f);
    if (f === this.target) return this.finish(true);
    if (this.guesses.length >= this.maxGuesses) return this.finish(false);
    this.render();
  },
  finish(won) {
    this.over = true;
    this.won = won;
    recordRound("emoji", won, this.guesses.length);
    this.render();
  },
};

/* ---------- Chrono : un max de combattants en 3 minutes ---------- */
const TimeAttack = {
  id: "timeattack",
  duration: 180,
  skipPenalty: 15,
  start() {
    this.stopTimer();
    this.phase = "intro";
    this.render();
  },
  begin() {
    this.phase = "play";
    this.score = 0;
    this.totalGuesses = 0;
    this.endAt = Date.now() + this.duration * 1000;
    this.hardcore = settings.hardcore;
    this.lastFound = null;
    this.newRound();
    this.timer = setInterval(() => this.tick(), 200);
  },
  newRound() {
    this.target = nextTarget();
    this.guesses = [];
    this.render();
  },
  stopTimer() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  timeLeft() { return Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000)); },
  fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; },
  tick() {
    const t = this.timeLeft();
    const chip = $("#ta-time");
    if (chip) { chip.textContent = this.fmt(t); chip.parentElement.classList.toggle("danger", t <= 20); }
    if (t <= 0) this.end();
  },
  end() {
    this.stopTimer();
    this.phase = "end";
    this.isRecord = recordScore("timeattack", this.score);
    this.render();
  },
  render() {
    onEnter = null;
    game.innerHTML = "";
    const s = modeStats("timeattack");
    if (this.phase === "intro") {
      const box = el("div", "start-screen", `<div class="big">⏱️</div><h2>Contre-la-montre</h2>
        <p>Trouve un maximum de combattants en <b>3 minutes</b> avec les indices du mode Classique.
        Passer un combattant coûte <b>${this.skipPenalty} s</b>.${settings.hardcore ? "<br>Mode <b>Hardcore</b> activé : pas d'orange ni de flèches." : ""}</p>
        <p>Record : <b>${s.highScore}</b></p>`);
      const b = el("button", "btn gold", 'Lancer <span class="kbd">(Entrée)</span>');
      b.addEventListener("click", () => this.begin());
      box.append(b);
      game.append(box);
      onEnter = () => this.begin();
      return;
    }
    if (this.phase === "end") {
      const box = el("div", "start-screen", `<div class="big">${this.isRecord && this.score > 0 ? "🏆" : "⌛"}</div><h2>Temps écoulé !</h2>
        <p>Tu as trouvé <b style="font-size:1.4rem;color:var(--accent2)">${this.score}</b> combattant${this.score > 1 ? "s" : ""}
        en ${this.totalGuesses} essai${this.totalGuesses > 1 ? "s" : ""}.</p>
        <p>${this.isRecord && this.score > 0 ? "Nouveau record !" : `Record : <b>${s.highScore}</b>`}</p>
        <p>Le dernier combattant était <b>${esc(this.target.name)}</b>.</p>`);
      const b = el("button", "btn gold", 'Rejouer <span class="kbd">(Entrée)</span>');
      b.addEventListener("click", () => this.begin());
      box.append(b);
      game.append(box);
      onEnter = () => this.begin();
      return;
    }
    game.append(hud([
      ["⏱️", `<span id="ta-time">${this.fmt(this.timeLeft())}</span>`],
      ["Trouvés", this.score, "hot"],
      ["Record", s.highScore],
      ...(this.hardcore ? [["Mode", "Hardcore", "danger"]] : []),
    ]));
    if (this.lastFound) game.append(el("p", "prompt", `✅ ${esc(this.lastFound)} trouvé ! Au suivant…`));
    else if (this.skipped) game.append(el("p", "prompt", `⏭️ C'était ${esc(this.skipped)}.`));
    else game.append(el("p", "prompt", "Vite, devine le combattant !"));
    const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
    game.append(input.node);
    const skip = el("button", "btn ghost give-up", `Passer (−${this.skipPenalty} s)`);
    skip.addEventListener("click", () => {
      this.endAt -= this.skipPenalty * 1000;
      this.lastFound = null;
      this.skipped = this.target.name;
      if (this.timeLeft() <= 0) return this.end();
      this.newRound();
    });
    game.append(skip);
    this.skipped = null;
    if (this.guesses.length) game.append(classicGrid(this.guesses, this.target, this.hardcore));
    input.focus();
  },
  guess(f) {
    this.guesses.push(f);
    this.totalGuesses++;
    if (f === this.target) {
      this.score++;
      this.lastFound = f.name;
      this.newRound();
    } else {
      this.lastFound = null;
      this.render();
    }
  },
  leave() { this.stopTimer(); },
};

/* ---------- Survie : réserve d'essais partagée ---------- */
const Survival = {
  id: "survival",
  startPool: 20,
  reward: 5,
  start() {
    this.phase = "intro";
    this.render();
  },
  begin() {
    this.phase = "play";
    this.lives = this.startPool;
    this.score = 0;
    this.hardcore = settings.hardcore;
    this.lastFound = null;
    this.newRound();
  },
  newRound() {
    this.target = nextTarget();
    this.guesses = [];
    this.render();
  },
  render() {
    onEnter = null;
    game.innerHTML = "";
    const s = modeStats("survival");
    if (this.phase === "intro") {
      const box = el("div", "start-screen", `<div class="big">❤️</div><h2>Survie</h2>
        <p>Tu commences avec <b>${this.startPool} essais</b> au total. Chaque proposition en consomme un,
        chaque combattant trouvé en rapporte <b>+${this.reward}</b>. Tiens le plus longtemps possible !
        ${settings.hardcore ? "<br>Mode <b>Hardcore</b> activé." : ""}</p>
        <p>Record : <b>${s.highScore}</b></p>`);
      const b = el("button", "btn gold", 'Lancer <span class="kbd">(Entrée)</span>');
      b.addEventListener("click", () => this.begin());
      box.append(b);
      game.append(box);
      onEnter = () => this.begin();
      return;
    }
    if (this.phase === "end") {
      game.append(resultPanel({
        won: false, target: this.target,
        lines: [`Plus d'essais ! Tu as survécu à <b style="color:var(--accent2)">${this.score}</b> combattant${this.score > 1 ? "s" : ""}.`,
          this.isRecord && this.score > 0 ? "🏆 Nouveau record !" : `Record : <b>${s.highScore}</b>`],
        actions: [{ label: "Rejouer", cls: "btn gold", kbd: "Entrée", onClick: () => this.begin() }],
      }));
      onEnter = () => this.begin();
      if (this.guesses.length) game.append(classicGrid(this.guesses, this.target, this.hardcore));
      return;
    }
    game.append(hud([
      ["❤️ Essais", this.lives, this.lives <= 5 ? "danger" : ""],
      ["Survécus", this.score, "hot"],
      ["Record", s.highScore],
      ...(this.hardcore ? [["Mode", "Hardcore", "danger"]] : []),
    ]));
    game.append(el("p", "prompt", this.lastFound ? `✅ ${esc(this.lastFound)} trouvé ! +${this.reward} essais` : "Chaque essai compte…"));
    const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
    game.append(input.node);
    if (this.guesses.length) game.append(classicGrid(this.guesses, this.target, this.hardcore));
    game.append(legend(this.hardcore));
    input.focus();
  },
  guess(f) {
    this.guesses.push(f);
    this.lives--;
    if (f === this.target) {
      this.score++;
      this.lives += this.reward;
      this.lastFound = f.name;
      return this.newRound();
    }
    this.lastFound = null;
    if (this.lives <= 0) {
      this.phase = "end";
      this.isRecord = recordScore("survival", this.score);
    }
    this.render();
  },
};

/* ---------- Silhouette : image noircie, zoomée, qui se dézoome à chaque erreur ---------- */
const ZOOMS = [2.5, 2.05, 1.7, 1.4, 1.15, 1];
const Silhouette = {
  id: "silhouette",
  start() {
    this.phase = "loading";
    this.render();
    probeImages().then(() => { if (current === this) this.afterProbe(); });
  },
  afterProbe() {
    this.list = pool().filter((f) => imageSrc.has(f.id));
    if (!this.list.length) { this.phase = "empty"; this.render(); }
    else this.newRound();
  },
  newRound() {
    this.list = pool().filter((f) => imageSrc.has(f.id));
    if (!this.list.length) { this.phase = "empty"; return this.render(); }
    this.phase = "play";
    this.target = nextTarget("silhouette", this.list);
    this.guesses = [];
    this.over = false;
    this.hardcore = settings.hardcore;
    this.max = this.hardcore ? 5 : 6;
    this.focus = `${25 + Math.random() * 50}% ${20 + Math.random() * 45}%`;
    this.mirror = this.hardcore && Math.random() < 0.5;
    this.prevZoom = ZOOMS[0];
    this.render();
  },
  zoom() {
    if (this.over) return 1;
    return ZOOMS[Math.min(ZOOMS.length - 1, this.guesses.length)];
  },
  render() {
    onEnter = null;
    game.innerHTML = "";
    if (this.phase === "loading") {
      game.append(el("div", "start-screen", `<div class="big">🔍</div><p>Recherche des images…</p>`));
      return;
    }
    if (this.phase === "empty") {
      const sample = FIGHTERS.slice(0, 6).map((f) => `<code>${imgSlug(f.name)}.png</code>`).join(", ");
      const box = el("div", "start-screen", `<div class="big">👤</div><h2>Aucune image trouvée</h2>
        <p>Le mode Silhouette utilise tes propres images. Dépose-les dans le dossier
        <code>img/fighters/</code> du projet, une par combattant, nommées d'après son nom en minuscules,
        sans accents ni espaces : ${sample}…</p>
        <p>Formats acceptés : PNG, WebP, JPG. Prends des <b>PNG à fond transparent</b> pour une vraie silhouette.
        La liste complète des noms de fichiers est dans <code>img/fighters/LISEZMOI.md</code>.</p>
        <p>Seuls les combattants qui ont une image (et qui sont dans ton pool) peuvent tomber.</p>`);
      const b = el("button", "btn gold", "Rechercher à nouveau");
      b.addEventListener("click", () => { this.phase = "loading"; this.render(); probeImages(true).then(() => { if (current === this) this.afterProbe(); }); });
      box.append(b);
      game.append(box);
      return;
    }
    const s = modeStats("silhouette");
    game.append(hud([
      ["Essais", `${this.guesses.length} / ${this.max}`],
      ["Série", s.streak, "hot"],
      ["Record", s.best],
      ["Images", `${this.list.length}`],
      ...(this.hardcore ? [["Mode", "Hardcore", "danger"]] : []),
    ]));
    game.append(el("p", "prompt", this.over ? "" : "À qui appartient cette silhouette ?"));

    const stage = el("div", `sil-stage ${this.over ? "revealed" : ""}`);
    const img = el("img", `sil-img ${this.over ? "" : "dark"}`);
    img.alt = "Silhouette mystère";
    img.draggable = false;
    img.src = imageSrc.get(this.target.id);
    img.style.transformOrigin = this.focus;
    const flip = this.mirror && !this.over ? " scaleX(-1)" : "";
    img.style.transform = `scale(${this.prevZoom})${flip}`;
    stage.append(img);
    game.append(stage);
    const z = this.zoom();
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transform = `scale(${z})${flip}`; }));
    this.prevZoom = z;

    if (this.over) {
      const won = this.won;
      game.append(resultPanel({
        won, target: this.target,
        lines: won ? [`Trouvé en <b>${this.guesses.length}</b> essai${this.guesses.length > 1 ? "s" : ""}.`] : [],
        actions: [{ label: "Silhouette suivante", cls: "btn gold", kbd: "Entrée", onClick: () => this.newRound() }],
      }));
      onEnter = () => this.newRound();
    } else {
      const input = makeGuessInput({ exclude: () => new Set(this.guesses.map((g) => g.id)), onPick: (f) => this.guess(f) });
      game.append(input.node);
      input.focus();
    }
    game.append(wrongList(this.guesses.filter((g) => g !== this.target)));
  },
  guess(f) {
    this.guesses.push(f);
    if (f === this.target) return this.finish(true);
    if (this.guesses.length >= this.max) return this.finish(false);
    this.render();
  },
  finish(won) {
    this.over = true;
    this.won = won;
    recordRound("silhouette", won, this.guesses.length);
    this.render();
  },
};

const MODES = { classic: Classic, enigme: Enigme, emoji: Emoji, silhouette: Silhouette, timeattack: TimeAttack, survival: Survival };

function switchMode(id) {
  if (current && current.leave) current.leave();
  current = MODES[id] || Classic;
  document.querySelectorAll("#modes button").forEach((b) => b.classList.toggle("active", b.dataset.mode === current.id));
  store.set("smash2le-mode", current.id);
  current.start();
}

document.querySelectorAll("#modes button").forEach((b) => b.addEventListener("click", () => switchMode(b.dataset.mode)));

/* =========================================================
   Modales : aide, stats, réglages
   ========================================================= */
const modal = $("#modal");
const modalBody = $("#modal-body");
function openModal(html, after) {
  modalBody.innerHTML = html;
  modal.hidden = false;
  if (after) after(modalBody);
}
function closeModal() { modal.hidden = true; }
$("#modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

const HELP = `<h2>Comment jouer</h2>
<p>Devine le combattant mystère parmi les ${FIGHTERS.length} combattants de Smash. Pas de limite quotidienne : enchaîne autant de parties que tu veux.</p>
<h3>Classique</h3>
<p>Propose un combattant : chaque attribut est comparé à celui de la cible.</p>
<ul>
  <li>🟩 <b>Vert</b> : identique.</li>
  <li>🟧 <b>Orange</b> : proche. Genre « Plusieurs » vs Homme/Femme, Humain vs Humanoïde, séries cousines (Mario / Yoshi / Wario / DK, Fire Emblem…), année à 3 ans près.</li>
  <li>🟥 <b>Rouge</b> : différent. ▲ = la cible est plus récente, ▼ = plus ancienne.</li>
</ul>
<h3>Énigme</h3><p>Pas de comparaison : les attributs de la cible se dévoilent un par un à chaque erreur. 8 essais max.</p>
<h3>Emoji</h3><p>4 emojis tirés au hasard dans une réserve de 7 à 10 par combattant, révélés un par un à chaque erreur. La combinaison et l'ordre changent à chaque partie. 7 essais max.</p>
<h3>Silhouette</h3><p>Une silhouette noire très zoomée qui se dézoome à chaque erreur. 6 essais max (5 en Hardcore, avec l'image parfois retournée). Ce mode utilise tes propres images, à déposer dans <code>img/fighters/</code>.</p>
<h3>Chrono</h3><p>Le plus de combattants possible en 3 minutes. Passer coûte 15 secondes.</p>
<h3>Survie</h3><p>Une réserve de 20 essais pour toute la partie, +5 par combattant trouvé.</p>
<h3>Hardcore</h3><p>Dans les réglages : plus d'orange ni de flèches, et 6 essais max en Classique. S'applique aussi à Chrono et Survie.</p>
<h3>Raccourcis</h3><p>↑ ↓ pour choisir dans la liste, <b>Entrée</b> pour valider ou passer au suivant, <b>Échap</b> pour fermer.</p>`;

function statsHtml() {
  const block = (id, title) => {
    const s = modeStats(id);
    const rate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    const maxD = Math.max(1, ...Object.values(s.dist));
    const keys = Object.keys(s.dist).map(Number).sort((a, b) => a - b);
    const dist = keys.length ? `<div class="dist">${keys.map((k) =>
      `<div class="dist-row"><span>${k}</span><span class="dist-bar" style="width:${Math.max(8, (s.dist[k] / maxD) * 100)}%">${s.dist[k]}</span></div>`).join("")}</div>` : "";
    return `<h3>${title}</h3><div class="stat-grid">
      <div><b>${s.played}</b><small>Parties</small></div>
      <div><b>${rate}%</b><small>Victoires</small></div>
      <div><b>${s.streak}</b><small>Série</small></div>
      <div><b>${s.best}</b><small>Meilleure série</small></div></div>${dist}`;
  };
  const score = (id, title) => `<h3>${title}</h3><div class="stat-grid">
    <div><b>${modeStats(id).played}</b><small>Parties</small></div>
    <div><b>${modeStats(id).highScore}</b><small>Record</small></div></div>`;
  return `<h2>Statistiques</h2>${block("classic", "Classique")}${block("enigme", "Énigme")}${block("emoji", "Emoji")}${block("silhouette", "Silhouette")}
    ${score("timeattack", "Chrono")}${score("survival", "Survie")}
    <p style="margin-top:18px"><button class="btn ghost" id="reset-stats">Réinitialiser les stats</button></p>`;
}

function settingsHtml() {
  const games = [1, 2, 3, 4, 5].map((g) =>
    `<button class="pill ${settings.games.includes(g) ? "on" : ""}" data-game="${g}">${SMASH_GAMES[g]}</button>`).join("");
  const origins = [["all", "Tous"], ["Nintendo", "Nintendo uniquement"], ["Tiers", "Tiers uniquement"]].map(([v, l]) =>
    `<button class="pill ${settings.origin === v ? "on" : ""}" data-origin="${v}">${l}</button>`).join("");
  return `<h2>Réglages</h2>
    <div class="toggle-row"><div><b>Mode Hardcore</b><small>Pas d'orange ni de flèches, 6 essais max en Classique</small></div>
      <button class="switch ${settings.hardcore ? "on" : ""}" id="hc"></button></div>
    <h3>Combattants introduits dans…</h3>
    <div class="pills">${games}</div>
    <h3>Éditeur</h3>
    <div class="pills">${origins}</div>
    <p id="pool-info"></p>
    <p><small style="color:var(--muted)">Les changements s'appliquent à la prochaine manche.</small></p>`;
}

function bindSettings(root) {
  const info = () => {
    const raw = FIGHTERS.filter((f) => settings.games.includes(f.smash) && (settings.origin === "all" || f.origin === settings.origin)).length;
    $("#pool-info", root).innerHTML = raw >= 3
      ? `<b>${raw}</b> combattants dans le pool.`
      : `<span style="color:#ff7b8f">Moins de 3 combattants : tout le roster sera utilisé.</span>`;
  };
  $("#hc", root).addEventListener("click", (e) => { settings.hardcore = !settings.hardcore; e.currentTarget.classList.toggle("on", settings.hardcore); saveSettings(); });
  root.querySelectorAll("[data-game]").forEach((b) => b.addEventListener("click", () => {
    const g = Number(b.dataset.game);
    settings.games = settings.games.includes(g) ? settings.games.filter((x) => x !== g) : [...settings.games, g];
    b.classList.toggle("on", settings.games.includes(g));
    saveSettings(); info();
  }));
  root.querySelectorAll("[data-origin]").forEach((b) => b.addEventListener("click", () => {
    settings.origin = b.dataset.origin;
    root.querySelectorAll("[data-origin]").forEach((x) => x.classList.toggle("on", x === b));
    saveSettings(); info();
  }));
  info();
}

document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
  const what = b.dataset.open;
  if (what === "help") openModal(HELP);
  else if (what === "stats") openModal(statsHtml(), (root) => {
    $("#reset-stats", root).addEventListener("click", () => {
      for (const k of Object.keys(stats)) delete stats[k];
      saveStats();
      openModal(statsHtml());
      if (current && !current.phase) current.render();
    });
  });
  else if (what === "settings") openModal(settingsHtml(), bindSettings);
}));

/* ---------- Lancement ---------- */
function probeSeries() {
  const all = [...new Set(FIGHTERS.map((f) => f.series))];
  return Promise.all(all.map(async (s) => {
    const src = `img/series/${imgSlug(s)}.png`;
    if (await canLoad(src)) seriesSrc.set(s, src);
  }));
}
probeSeries().then(() => switchMode(store.get("smash2le-mode", "classic")));
if (!store.get("smash2le-seen-help", false)) { store.set("smash2le-seen-help", true); openModal(HELP); }
