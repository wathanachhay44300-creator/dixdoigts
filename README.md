# DixDoigts

Site pour apprendre à taper **à dix doigts** sur un clavier AZERTY. Français, gratuit, **sans compte** : la progression reste dans le navigateur.

Nom provisoire : pour le changer, modifie `DD.APP_NAME` dans `js/util.js`, la balise `<title>` et le texte « DixDoigts » du `<span data-app-name>` dans `index.html` (le reste suit).

## Ce que contient le site

- **Guide des mains** : posture, position de repos (F et J), un doigt par touche, majuscules avec la main opposée.
- **Clavier visuel** coloré par doigt, avec la touche suivante en surbrillance. Il se masque d'un clic (le badge « À l'aveugle » récompense les exercices réussis sans lui).
- **Mains réalistes et animées** posées sur le clavier visuel, semi-transparentes (50 % par défaut, réglable de 20 à 80 %) : deux mains vues de dessus, dessinées en SVG par couches (un groupe par doigt et par phalange, paumes, pouces, ongles, dégradés, ombres douces). Le doigt concerné va vers la touche, appuie, puis revient ; seul ce doigt bouge (pour les chiffres les plus éloignées, la main avance un peu). Maj : l'auriculaire de la main opposée appuie en même temps ; AltGr : le pouce droit ; touche morte : `^` puis la voyelle ; erreur : secousse du doigt attendu et éclat rouge discret sur la touche. Bouton **« Voir la démo »** (lente ou normale) : les mains tapent seules le texte de l'exercice, sans rien compter. Elles apparaissent dans les leçons, l'atelier, le guide, les pages de module et les tests ; elles disparaissent avec le clavier et ne bloquent jamais la souris ni la saisie. Réglages : afficher/masquer, opacité, teinte (peau claire, moyenne, foncée, « fantôme bleu »), vitesse. Mouvement réduit du système : les mains restent fixes et le doigt à utiliser est surligné ; machine lente : animation simplifiée automatiquement.
- **Images PNG en option** : dépose tes propres images transparentes dans `assets/hands/` et active-les dans `assets/hands/hands.json` (voir `assets/hands/README.md`). Aucune image n'est fournie ; sans elles, ce sont les mains SVG.
- **10 modules** : rangée de base, rangée du haut, rangée du bas, mots et phrases, majuscules, accents (avec la touche morte `^`), chiffres, ponctuation, vitesse, maîtrise. Chaque exercice génère un texte différent à chaque essai.
- **Leçons en étapes** (modules 1, 2, 3, 6 et 7) : introduction, répétition pure (`vvv bbb vbv bvb`), alternances de mains et de doigts (`vn nv vnb`), pseudo-mots (`cxnv`), mots réels (seulement s'il y en a au moins 30 avec ces touches), puis mini-test d'1 minute. Uniquement les touches de la leçon et celles déjà vues dans la même rangée : **aucune phrase** avant le module 4.
- **Fin de chaque module** : 3 séries d'endurance de 2 à 3 minutes (avec une courte pause entre elles), un test de maîtrise de 2 minutes à 95 % de précision, puis une révision en mélange (au moins 50 % de touches du module, le reste vient des modules précédents).
- **Longueur des séries réglable** (courte ≈ 60, normale ≈ 150, longue ≈ 300 caractères), barre « répétitions X / N », séries refaisables à l'infini avec un contenu nouveau.
- **Atelier de répétitions** : tu choisis les touches (clavier cliquable ou préréglages : rangées, chiffres, accents, ponctuation, un doigt précis, une main), le type d'exercice (répétition, alternances, pseudo-mots, mots réels, mélange), la durée (minutes ou caractères) et l'option « insister sur mes touches les plus ratées ». Les exercices sont gardés dans l'historique et comptent dans l'objectif du jour et la série, mais pas comme tests chronométrés (ni pour les badges de vitesse, ni pour le certificat).
- **Déverrouillage libre** : l'ordre du parcours est conseillé (badge « Recommandé »), jamais obligatoire. Les modules et leçons non atteints sont « verrouillés » avec un bouton « Déverrouiller » (un clic, puis un message « conseillé après… »). Le réglage « Tout déverrouiller » (page Leçons et Réglages) ouvre tout d'un coup et peut être désactivé à tout moment. **Déverrouiller n'est pas valider** : l'état « déverrouillé » est enregistré à part de l'état « validé » (étoiles, scores, modules terminés). Un module ou une leçon déverrouillé reste sans étoiles, sans badge et sans progression tant qu'il n'est pas réellement réussi. « Continuer » mène toujours à la première leçon non validée.
- **Tests de passage** (modules 1 à 8) pour sauter un module déjà acquis : 95 % de précision et 20 à 25 MPM. Ils restent possibles même sur un module verrouillé, et valident le module quand on les réussit.
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
| `js/generator.js` | **générateur d'exercices**, module pur (sans navigateur), graine aléatoire reproductible |
| `js/curriculum.js` | les 10 modules, leurs leçons, étapes et fins de module |
| `js/typing.js` | saisie clavier, affichage du texte |
| `js/run.js` | exercice « strict » (la frappe n'avance que si elle est juste), durée limitée, « répétitions X / N » |
| `js/keyboard.js` | clavier visuel (touches, surbrillance, appui), carte de chaleur |
| `js/hand-model.js` | **modèle des mains**, module pur : doigt et mouvement de chaque touche, cinématique d'un doigt à trois segments, pouce, déplacement de la main |
| `js/hands.js` | dessin SVG des mains, animation (ressorts, `requestAnimationFrame`), démo, mouvement réduit, mode allégé, option images |
| `assets/hands/` | option : tes images PNG et leur configuration (`hands.json`) |
| `js/charts.js` | graphiques SVG |
| `js/pdf.js` | générateur de certificat PDF |
| `js/badges.js` | badges |
| `js/view-lesson.js` | leçon en étapes, fin de module (endurance, pause, maîtrise, révision) |
| `js/view-workshop.js` | atelier de répétitions |
| `js/view-*.js`, `js/app.js` | autres écrans et routeur |
| `tests/` | tests automatiques et validation du corpus |

Scripts classiques (pas de modules ES) : le site marche aussi ouvert directement depuis le disque.

## Tests

Il faut Node (version 20 ou plus), rien d'autre à installer :

```bash
npm test
```

(ou `node --test tests/*.test.js` puis `node tests/validate-corpus.js`). Les tests vérifient notamment :

- le générateur : caractères autorisés, équilibre des touches, graine reproductible, pondération des touches ratées, pas de séquences absurdes, mots réels seulement à partir de 30 mots ;
- le programme : aucune phrase dans les modules 1 à 3, aucune touche utilisée avant d'être introduite, révision à au moins 50 % de touches du module, tout se tape sur AZERTY Mac et PC ;
- les mains (`tests/hands.test.js`) : chaque touche de l'AZERTY (Mac et PC) a un doigt et un mouvement, le bout du doigt arrive au centre de chaque touche, Maj / AltGr / touches mortes, les pouces ne se croisent pas, réglages (opacité bornée, teintes) et leur migration ;
- la migration : les anciennes données (étoiles, tests, badges, jours, réglages) sont conservées, les modules déjà terminés le restent ;
- le déverrouillage (`tests/unlock.test.js`) : déverrouiller n'écrit rien dans les validations, « Tout déverrouiller » s'active et se désactive sans rien perdre, une leçon déverrouillée mais ratée n'a ni étoiles ni badge, « Continuer » ignore les déverrouillages, les données du schéma 2 sont migrées sans refaire la conversion de l'ancien programme.

`tests/validate-corpus.js` affiche aussi, pour chaque leçon, le nombre de mots réels disponibles (la rangée de base et la rangée du bas n'en ont pas assez : c'est normal, l'étape « mots réels » est alors ignorée).

## Anciennes données

Le format de sauvegarde porte un numéro de structure (`schema`, actuellement 3). Une progression enregistrée avec l'ancien programme (`schema` absent) est convertie automatiquement au chargement ou à l'import : étoiles, historique, badges et jours sont gardés, et un module dont toutes les anciennes leçons étaient réussies reste terminé. Les réglages des mains (`showHands`, `handOpacity`, `handTint`, `handSpeed`, `demoSpeed`) reçoivent des valeurs par défaut sur les anciennes données. Le schéma 3 ajoute `unlocks` (modules et leçons déverrouillés à la main) et le réglage `unlockAll` ; les données plus anciennes les reçoivent vides, et les modules ouverts par la progression le restent.

## Données

Tout est enregistré dans `localStorage` sous la clé `dixdoigts:v1` : leçons, tests, frappes par touche, jours d'entraînement, badges, réglages. Rien n'est envoyé nulle part. Une disposition QWERTY est détectée (Chrome, Edge) et signalée.

## Touches mortes (â ê î ô û, ë ï)

- Sur AZERTY, `^` puis une voyelle donne â ê î ô û ; `Maj + ^` (¨) puis une voyelle donne ä ë ï ö ü. `^` puis espace donne `^`.
- Cause du bug d'origine : le moteur annulait (`preventDefault`) la touche morte, donc le navigateur ne composait jamais l'accent et la voyelle arrivait seule (comptée comme une erreur).
- Correction : `js/deadkeys.js` (machine à états pure, testée dans `tests/deadkeys.test.js`) + un champ caché qui reçoit la frappe (`js/typing.js`). Elle accepte la composition du navigateur, une touche déjà composée, ou, en secours, la table `^`/`¨` + voyelle.
- Diagnostic : page `#/diagnostic` (liée depuis Réglages), qui affiche en direct keydown / beforeinput / input / composition* et ce que DixDoigts en comprend.
- Corpus : tout en NFC ; `node tests/validate-corpus.js` échoue sur un texte non NFC ou un accent décomposé.
