# DixDoigts

Site pour apprendre à taper **à dix doigts** sur un clavier AZERTY. Français, gratuit, **sans compte** : la progression reste dans le navigateur.

Nom provisoire : pour le changer, modifie `DD.APP_NAME` dans `js/util.js`, la balise `<title>` et le texte « DixDoigts » du `<span data-app-name>` dans `index.html` (le reste suit).

## Ce que contient le site

- **Guide des mains** : posture, position de repos (F et J), un doigt par touche, majuscules avec la main opposée.
- **Clavier visuel** coloré par doigt, avec la touche suivante en surbrillance. Il se masque d'un clic (le badge « À l'aveugle » récompense les exercices réussis sans lui).
- **10 modules, 51 leçons** : rangée de base, rangée du haut, rangée du bas, mots et phrases, majuscules, accents (avec la touche morte `^`), chiffres, ponctuation, vitesse, maîtrise. Chaque leçon génère un texte différent à chaque essai.
- **Tests de passage** (modules 1 à 8) pour sauter un module déjà acquis : 95 % de précision et 20 à 25 MPM.
- **Test chronométré** de 1, 2, 3 ou 5 minutes : MPM, précision, courbe seconde par seconde, touches ratées, carte de chaleur. Interrupteur **2 doigts / 10 doigts** : les deux séries sont enregistrées séparément.
- **Statistiques** : courbe de progression à dix doigts avec une ligne pour le niveau à deux doigts (80 MPM par défaut, réglable), minutes par jour, carte de chaleur, historique.
- **S'entraîner sur mes points faibles** : exercice construit à partir des touches les plus ratées.
- **Série de jours** (objectif quotidien réglable, 10 min par défaut), **32 badges**, **certificat PDF** généré dans le navigateur.
- **Sons de frappe** synthétisés (3 styles), réglables.
- **Sauvegarde en fichier** (export / import JSON) au cas où le navigateur serait vidé.

Hors périmètre volontairement : XP et niveaux, jeux, mode sombre, mobile, rappels, anglais, plan par semaines.

## Lancer en local

Aucune installation. Au choix :

- double-clic sur `index.html` ;
- ou, dans ce dossier : `python3 -m http.server 8000` puis http://localhost:8000.

Le site n'utilise aucune dépendance externe (ni CDN, ni bibliothèque) : tout est dans ce dossier.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt GitHub et envoie-y ce dossier (le fichier `index.html` doit être à la racine).
2. Sur GitHub : **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.
3. Au bout d'une minute, le site est en ligne à `https://<ton-compte>.github.io/<nom-du-dépôt>/`.

Avec l'outil `gh` :

```bash
git init -b main && git add . && git commit -m "DixDoigts"
gh repo create dixdoigts --public --source=. --push
gh api -X POST repos/{owner}/dixdoigts/pages -f "source[branch]=main" -f "source[path]=/"
```

Le fichier `.nojekyll` évite que GitHub Pages ne retraite les fichiers.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html`, `css/style.css` | page unique, thème clair |
| `js/util.js` | utilitaires, nom du site |
| `js/store.js` | sauvegarde (`localStorage`), série de jours, export / import |
| `js/layout.js` | dispositions AZERTY Mac et PC, doigts, « quelles touches pour ce caractère » |
| `js/words.js` | mots, phrases, générateurs de textes (dont points faibles) |
| `js/curriculum.js` | les 10 modules et leurs leçons |
| `js/typing.js` | saisie, affichage du texte, exercice « strict » des leçons |
| `js/keyboard.js` | clavier visuel, carte de chaleur, schéma des mains |
| `js/charts.js` | graphiques SVG |
| `js/pdf.js` | générateur de certificat PDF |
| `js/badges.js` | badges |
| `js/view-*.js`, `js/app.js` | écrans et routeur |

Scripts classiques (pas de modules ES) : le site marche aussi ouvert directement depuis le disque.

## Données

Tout est enregistré dans `localStorage` sous la clé `dixdoigts:v1` : leçons, tests, frappes par touche, jours d'entraînement, badges, réglages. Rien n'est envoyé nulle part. Une disposition QWERTY est détectée (Chrome, Edge) et signalée.
