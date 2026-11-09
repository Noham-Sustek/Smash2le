# Smash2le

Jeu de devinettes sur les combattants de Smash, à jouer en local **sans limite quotidienne**.
HTML/CSS/JS pur : aucune dépendance, aucun build.

## Lancer

- **Le plus simple** : double-clique sur `index.html`.
- **Ou avec un serveur local** :
  ```bash
  python -m http.server 8000
  ```
  puis ouvre <http://localhost:8000>.

## Modes de jeu

| Mode | Principe |
|---|---|
| **Classique** | Propose un combattant et compare ses attributs (genre, espèce, série, éditeur, 1er Smash, année de 1re apparition) à ceux de la cible. Vert = identique, orange = proche, ▲▼ = plus récent ou plus ancien. |
| **Énigme** | Les attributs de la cible se dévoilent un par un à chaque erreur. 8 essais max. |
| **Emoji** | 4 emojis, du plus obscur au plus évident, révélés à chaque erreur. 7 essais max. |
| **Silhouette** | Une silhouette noire très zoomée qui se dézoome à chaque erreur. 6 essais max. Utilise **tes propres images** (voir plus bas). |
| **Chrono** | Le plus de combattants possible en 3 minutes. Passer coûte 15 s. |
| **Survie** | Une réserve de 20 essais pour toute la partie, +5 par combattant trouvé. |

**Réglages** : mode Hardcore (pas d'orange ni de flèches, 6 essais max en Classique), choix du pool
(combattants introduits dans 64 / Melee / Brawl / 3DS-Wii U / Ultimate, Nintendo ou tiers uniquement).

Les stats (séries, records, distribution des essais) sont gardées dans le `localStorage` du navigateur.

## Images pour le mode Silhouette

Le dépôt ne contient aucune image officielle. Dépose les tiennes dans `img/fighters/`
(ce dossier est ignoré par git), une par combattant, nommée d'après son nom en minuscules, sans accents ni espaces :
`mario.png`, `donkeykong.png`, `samussombre.png`… Le nom anglais marche aussi (`darksamus.png`).
La liste complète est dans [`img/fighters/LISEZMOI.md`](img/fighters/LISEZMOI.md).

- Prends des **PNG à fond transparent** (les renders officiels par exemple) : le jeu les noircit pour faire la silhouette.
- Tu n'es pas obligé de tout remplir : seuls les combattants qui ont une image tombent dans ce mode.

## Données

Tout est dans `js/data.js` : 84 entrées (roster d'Ultimate, les trois Mii regroupés en un seul).
Pour corriger un attribut ou les emojis d'un personnage, il suffit d'éditer sa ligne.

---

Jeu de fan non officiel. Les noms des personnages appartiennent à leurs ayants droit.
