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
| **Chrono** | Le plus de combattants possible en 3 minutes. Passer coûte 15 s. |
| **Survie** | Une réserve de 20 essais pour toute la partie, +5 par combattant trouvé. |

**Réglages** : mode Hardcore (pas d'orange ni de flèches, 6 essais max en Classique), choix du pool
(combattants introduits dans 64 / Melee / Brawl / 3DS-Wii U / Ultimate, Nintendo ou tiers uniquement).

Les stats (séries, records, distribution des essais) sont gardées dans le `localStorage` du navigateur.

## Données

Tout est dans `js/data.js` : 84 entrées (roster d'Ultimate, les trois Mii regroupés en un seul).
Pour corriger un attribut ou les emojis d'un personnage, il suffit d'éditer sa ligne.

---

Jeu de fan non officiel. Les noms des personnages appartiennent à leurs ayants droit.
