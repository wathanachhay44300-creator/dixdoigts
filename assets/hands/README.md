# Images de mains (option)

Par défaut, DixDoigts dessine les mains en **SVG** (dessins originaux, inclus dans `js/hands.js`, aucune image, aucune licence externe).

Tu peux les remplacer par tes **propres images PNG transparentes**. Ce dossier est vide d'images volontairement : aucune photo n'est fournie.

> N'utilise que des images dont tu as les droits (les tiennes, ou sous une licence qui l'autorise clairement, par exemple CC0).

## Comment activer

1. Dépose tes PNG dans ce dossier.
2. Ouvre `hands.json` et mets `"enabled": true`.
3. Recharge la page. Si une image manque ou ne se charge pas, le site revient tout seul aux mains SVG.

Le fichier est lu seulement quand le site est servi en `http(s)` (GitHub Pages, ou `python3 -m http.server`). Ouvert directement depuis le disque (`file://`), le navigateur refuse de le lire : les mains SVG restent affichées.

## Deux modes

### `"mode": "per-segment"` : une image par phalange (les doigts bougent un par un)

Chaque doigt a **3 images** (phalange du bas, du milieu, du bout) ; chaque pouce en a **2**. Les noms sont libres : ils sont écrits dans `hands.json`.

- Chaque image représente la phalange **droite, pointant vers le haut**, la base en bas et le bout en haut.
- Elle sera étirée pour remplir sa phalange : garde les proportions d'une phalange réelle (longue et étroite).
- Longueurs relatives d'un doigt : 46 % (bas), 31 % (milieu), 23 % (bout).
- La paume reste dessinée en SVG sous tes doigts.

### `"mode": "per-hand"` : une image par main (la main entière est posée au repos)

- `left` et `right` : une image de chaque main vue de dessus, doigts vers le haut, sur fond transparent.
- La main entière suit légèrement le doigt à utiliser ; ce doigt est entouré d'un halo. Les doigts ne se plient pas séparément.
- `width` : largeur de l'image, en largeurs de touche (6 à 7 donne une main réaliste). `aspect` : largeur / hauteur de l'image. `anchor` : le point de l'image (de 0 à 1, en x puis en y) placé entre les deux doigts du milieu, au niveau de la rangée de repos. `scale` : un facteur d'agrandissement.

## Réglages

L'opacité (20 à 80 %), la vitesse et l'affichage se règlent dans **Réglages → Mains sur le clavier**. La teinte ne s'applique qu'aux mains SVG : tes images gardent leurs couleurs.
