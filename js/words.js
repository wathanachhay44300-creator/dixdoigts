/* Mots, phrases et générateurs de textes d'entraînement (tout en français, tout en minuscules sauf mention). */
(function () {
  const DD = window.DD;
  const rnd = DD.rnd;

  const RAW = `
    le la les un une des du de et en au aux ce cet cette ces je tu il elle on nous vous ils elles
    mon ton son ma ta sa mes tes ses notre votre leur nos vos leurs qui que quoi dont où ou car mais donc
    or ni si ne pas plus bien très trop peu tout tous toute toutes rien jamais déjà encore aussi alors
    puis après avant avec sans sous sur dans par pour chez vers entre depuis
    être avoir faire dire aller voir savoir pouvoir vouloir venir devoir prendre trouver donner falloir
    parler mettre passer regarder aimer croire demander rester répondre entendre penser arriver connaître
    devenir sentir sembler tenir comprendre rendre attendre sortir vivre ouvrir écrire jouer lire manger
    boire dormir marcher courir chanter danser cuisiner travailler étudier apprendre acheter vendre porter
    changer chercher commencer finir oublier partir revenir tomber monter descendre entrer laisser montrer
    garder appeler suivre ranger lever poser casser réparer nager voyager visiter inviter aider
    maison jour temps homme femme enfant ami monde vie main ville rue route chemin pont jardin arbre fleur
    herbe forêt rivière montagne mer plage ciel soleil lune étoile nuage pluie vent neige orage lumière
    ombre nuit matin soir semaine mois année heure minute seconde histoire livre page mot phrase lettre
    texte voix bruit silence musique chanson film image photo carte table chaise fenêtre porte mur toit
    chambre cuisine salon escalier lit tapis lampe miroir verre tasse assiette couteau fourchette cuillère
    pain fromage fruit légume pomme poire cerise citron tomate carotte salade soupe gâteau chocolat sucre
    sel café thé lait eau jus vin repas déjeuner dîner idée question réponse problème solution projet
    travail métier école classe élève professeur leçon examen note mémoire esprit chien chat oiseau poisson
    cheval vache mouton lapin souris renard loup ours singe tigre lion train bus voiture vélo avion bateau
    gare port aéroport marché magasin banque hôtel hôpital musée théâtre cinéma parc place pays région
    famille frère soeur mère père cousin voisin voisine ami amie sac clé clef papier crayon stylo cahier
    ordinateur clavier écran souris téléphone message courrier cadeau fête jeu sport match équipe
    grand petit gros long court haut bas large étroit lourd léger fort faible doux dur chaud froid frais
    sec humide propre sale beau joli laid bon mauvais vieux jeune nouveau ancien premier dernier même autre
    seul simple facile difficile rapide lent calme heureux triste content fatigué prêt libre sûr vrai faux
    possible utile rare clair sombre rouge bleu vert jaune noir blanc gris rose violet brun doré
    toujours souvent parfois demain hier ici là partout ailleurs dehors dedans devant derrière dessus
    dessous près loin vite doucement lentement ensemble seulement vraiment quand comme comment pourquoi
    combien beaucoup assez moins autant presque quelque chaque plusieurs certain aucun
    un deux trois quatre cinq six sept huit neuf dix vingt cent mille
    lundi mardi mercredi jeudi vendredi samedi dimanche janvier mars avril mai juin juillet septembre
    octobre novembre
    quartier couloir balcon terrasse bureau atelier garage cave grenier rideau canapé fauteuil armoire
    étagère tiroir bougie horloge montre valise parapluie chapeau manteau veste pantalon chemise robe
    chaussure écharpe gant lunettes bijou anneau collier
    pratique exercice habitude patience rythme vitesse précision régularité progrès effort repos pause
    souplesse posture épaule poignet doigt pouce index paume
    brillant tranquille minuscule immense magnifique curieux joyeux timide courageux généreux paisible
    ancien récent proche lointain profond étrange ordinaire spécial précieux fragile solide
    bavarder murmurer sourire rire pleurer crier siffler écouter observer imaginer inventer construire
    dessiner peindre réfléchir décider préparer terminer continuer recommencer essayer réussir
    échanger envoyer recevoir ajouter retirer remplir vider ouvrir fermer allumer éteindre
  `;

  // Mots avec accents "à apprendre" (en plus de la liste ci-dessus)
  const ACCENT_EXTRA = `
    été école écrire éléphant élève étoile étage église énergie équipe écran écouter épaule électrique
    élégant énorme éclair éviter échelle économie éducation espérer préférer répéter célèbre général
    témoin vérité liberté beauté clarté santé idée musée année journée soirée matinée fumée pensée pressé
    fermé désert désir décider décrire découvrir décembre février réponse réveil régime région règle
    mémoire véritable éternel étonnant été
    mère père frère rivière manière matière lumière première dernière entière légère chère fidèle modèle
    problème système thème poème scène siècle règle zèbre cèdre
    déjà voilà là à
    ça français garçon leçon façon reçu commençons glaçon façade aperçu soupçon balançoire
    où
    fenêtre forêt tête fête bête rêve rêver même être prêt arrêter pêche pêcheur extrême crêpe
    âge âme pâte pâle gâteau château bâtiment théâtre bâton âne
    île maître connaître paraître dîner huître abîme fraîcheur aîné traîner
    hôtel côté rôle contrôle drôle hôpital bientôt tôt plutôt allô diplôme fantôme symptôme aussitôt
    sûr mûr coûter dû goûter flûte août coûteux piqûre mûrir
  `;

  // Mots écrits uniquement avec les touches de la rangée du haut (a z e r t y u i o p) :
  // il en faut au moins 30 pour proposer des « mots réels » dans le module 2.
  const TOP_ROW_WORDS = `
    tu te ta ou or et eu au eau air aire art arte pie pire pur pure rue ruer rat rare rire ire tour tout
    toute tuer trier tirer taire tarte tapir tapez payer pirate pitre poire poirier poterie porte porter
    partie part pare prie prier priez port pot trio trop troupe troupeau route roue ratio rater outre
    ouate euro aorte oui type typo tripe retirer reporter apporter rapporter terrier tutoyer pierre
    zip zut azur azote zoo pizza pizzeria riez tuez payez portez partiez trouez paire taupe poutre
    outrer tourte pourri pourrie trouer tripoter peur toit tuyau rayure retour tortue terre auto autre
    autour tuteur porteur rapport apport report trait traite tirait partir partit tarir
    pourrir pourrai pariez apurer apeure appuie appui zapper zappe
  `;

  // Mots en plus pour les leçons d'accents (assez de mots pour chaque leçon)
  const ACCENT_MORE = `
    maçon pinçon limaçon hameçon forçat façonner reçoit reçue déçu déçue perçu aperçoit commença garçons
    leçons façons maçons glaçons soupçons agaçant glaçage tronçon rançon façades plaçons avançons perçons
    traçons effaçons
    têtu bêtise pêcher forêts fenêtres rêves têtes fêtes bêtes gêner enquête tempête conquête honnête
    prêter prêts arrêt arrêts
    gâteaux châteaux bâtiments pâtes pâtisserie âgé mâcher grâce tâche plâtre bâtir âpre câble râteau
    maîtriser plaît gîte abîmer traîneau chaîne boîte fraîche naître
    rôti pôle hôte arôme cône tôle côte côtes diplômé drôlement
    brûler brûlé mûre sûrement flûtes piqûres goûts goûté
    noël noëls canoë canoës aiguë ciguë ambiguë contiguë exiguë
    naïf naïve naïfs naïves maïs haïr égoïste héroïque héroïne coïncidence coïncider ouïe païen aïeul aïeux
    laïque mosaïque mosaïques faïence stoïque glaïeul inouï ambiguïté archaïque caïman
  `;

  const uniq = (s) => Array.from(new Set(s.split(/\s+/).filter(Boolean).map((w) => w.normalize('NFC'))));
  const WORDS = uniq(RAW + ' ' + ACCENT_EXTRA + ' ' + TOP_ROW_WORDS + ' ' + ACCENT_MORE);
  const PLAIN = WORDS.filter((w) => /^[a-z]+$/.test(w));

  const SIMPLE = [
    'le chat dort sur le tapis',
    'nous mangeons une pomme rouge',
    'il fait beau ce matin',
    'mon voisin joue dans le jardin',
    'elle lit un livre sur la plage',
    'le train part dans une heure',
    'nous allons voir un film ce soir',
    'les enfants courent vers la mer',
    'un petit chien suit son ami',
    'le vent souffle sur la colline',
    'ma voisine arrose ses fleurs chaque jour',
    'tu peux prendre le bus pour venir',
    'cette soupe est trop chaude pour moi',
    'on se retrouve devant la gare',
    'le soleil brille sur le port',
    'il pose son sac sur la table',
    'nous avons bu un jus de pomme',
    'la route traverse un grand bois',
    'vous pouvez entrer par cette porte',
    'un oiseau chante dans le grand arbre',
    'le boulanger sort un pain tout chaud',
    'nous jouons au ballon sur la pelouse',
    'la lune monte au dessus du lac',
    'ils prennent du lait chaud avant de dormir',
  ];

  const SENTENCES = [
    "Bonjour, je m'appelle Léa et j'habite à Lyon.",
    'Il est huit heures : le café est prêt !',
    'Pourquoi les nuages sont-ils si légers ?',
    'Nous partirons demain matin, après le petit déjeuner.',
    'Le 12 mai, il a plu toute la journée.',
    'Elle a répondu : "Je préfère rester à la maison."',
    'Quel beau temps pour une promenade en forêt !',
    'Mon frère et moi, nous aimons jouer aux échecs.',
    "Peux-tu m'envoyer la photo que tu as prise hier ?",
    'Les étoiles brillent déjà au-dessus de la mer.',
    "C'est à Paris, près de la gare, qu'ils se sont rencontrés.",
    'Il y a 3 pommes, 2 poires et 12 cerises dans le panier.',
    "On dit que la patience est la clé de tout apprentissage.",
    'Voilà une idée simple, claire et efficace.',
    'Où as-tu rangé les clés de la voiture ?',
    'Le train de 7 h 45 arrive à Nantes vers 10 h.',
    'Après la pluie, le soleil revient toujours.',
    'Il m\'a dit : "Reste un peu, la soirée commence !"',
    'Les élèves ont écrit une longue lettre à leur professeur.',
    "Tu veux du thé, du café ou un jus d'orange ?",
    "Chaque jour, elle s'entraîne vingt minutes sans regarder ses mains.",
    "Rome n'a pas été bâtie en un jour, dit le proverbe.",
    'La réunion est prévue le 3 juin à 14 h 30.',
    'Ils ont acheté du pain, du fromage et quelques fruits.',
    "Quand on aime ce qu'on fait, le temps passe vite.",
    'Attention : la peinture est fraîche !',
    'Mes voisins reviennent du marché avec un panier de légumes.',
    "L'été dernier, nous avons visité une île magnifique.",
    "Je ne savais pas qu'il fallait autant de patience !",
    'Joël a offert un canoë à Maëlle pour Noël.',
    'Ma grand-mère a fait une mosaïque naïve pour sa cuisine.',
    'Le maïs pousse bien cet été, même sous la pluie.',
    "Il a fêté ses vingt ans dans un hôtel près de l'île.",
    "La forêt était silencieuse, et l'air froid avait un goût de neige.",
    "Le chef a goûté la soupe, puis il a ajouté un peu de sel.",
    'Le bâtiment est très âgé, mais il reste beau.',
    'Le gâteau est prêt : goûte-le avant les autres !',
    'Le château domine la vallée, et la brume se lève tôt.',
    'Nos hôtes ont ouvert la porte avec un grand sourire.',
    'Il a mûri depuis son voyage : il est plus sûr de lui.',
    'Nous avons été surpris par une odeur de brûlé.',
    'Raphaël et Michaël ont aidé Maëlle à ranger le canoë.',
    'Noël approche, et la maison sent déjà la cannelle.',
    'La chaîne de montagnes se perd dans les nuages.',
    "Mon frère s'est coupé le doigt en ouvrant la boîte.",
    'Il faut que tu te dépêches, sinon tu rateras le train.',
    "Vous êtes arrivés tôt : le déjeuner n'est pas encore prêt.",
    'Le maître a corrigé la dictée, puis il a rangé les cahiers.',
    "La fête de l'école est un beau moment pour tout le monde.",
    'Ma mère a pâli en lisant la lettre, puis elle a souri.',
    'Il a laissé sa veste près du poêle, sur le dos de la chaise.',
    'Ce vêtement est trop grand pour moi : je préfère le bleu.',
    "Un bateau a dérivé sous un ciel gris, loin de l'île.",
  ];

  const NAMES = 'Marie Paul Sophie Lucas Julie Thomas Emma Louis Camille Hugo Clara Alice Jules Adam Manon Enzo Nina Victor Quentin Wendy Xavier Yann Karim Bruno Gaston Hélène'.split(' ');
  const NAMES_PLAIN = NAMES.filter((n) => /^[A-Za-z]+$/.test(n));
  const CITIES = 'Paris Lyon Marseille Toulouse Nice Nantes Bordeaux Lille Rennes Dijon Brest Reims Tours Caen Metz Nancy Amiens Rouen Limoges Perpignan Grenoble Strasbourg Montpellier Toulon Angers Cannes Annecy Calais'.split(' ');

  const PASSAGES = [
    {
      title: 'Le réveil de la ville',
      text: "Le matin, la ville se réveille lentement. Les boulangers sortent les premières baguettes, les volets s'ouvrent un à un et l'odeur du café flotte dans la rue. Un cycliste file le long du canal, pressé d'arriver avant huit heures. Rien ne semble avoir changé depuis hier, et pourtant chaque journée garde sa petite surprise.",
    },
    {
      title: 'Apprendre à taper',
      text: "Apprendre à écrire sans regarder ses doigts demande de la patience. Au début, on avance moins vite qu'avant, on hésite, on se trompe, et c'est normal. Puis, un matin, les mains trouvent seules le chemin des touches. On pense à la phrase, pas au clavier : c'est là que la vitesse arrive vraiment.",
    },
    {
      title: 'Chiffres et dates',
      text: "Le 14 juillet 2026, plus de 3 000 personnes ont traversé le pont en 25 minutes, soit environ 120 personnes par minute. Le prix du billet était de 12 euros, mais les enfants de moins de 10 ans entraient gratuitement. Vers 18 h 30, le feu d'artifice a commencé.",
    },
    {
      title: 'Un dialogue',
      text: 'Où vas-tu ? demanda Léa. "Au marché, répondit son frère ; il me faut des tomates, du basilic et trois citrons." Elle sourit, ferma la porte à clé et le suivit dans l\'escalier. Dehors, le ciel était gris, mais personne ne s\'en plaignait !',
    },
    {
      title: 'Le bon dactylo',
      text: "Un bon clavier ne fait pas un bon dactylo, mais un bon dactylo reconnaît vite le sien. Entre deux phrases, il laisse reposer ses poignets, redresse le dos et garde les épaules détendues. Vingt minutes bien réparties valent mieux qu'une heure de fatigue : la régularité l'emporte toujours sur l'effort ponctuel.",
    },
  ];

  const MONTHS = 'janvier mars avril mai juin juillet septembre octobre novembre'.split(' ');
  const NOUNS_PL = 'chats pommes livres minutes euros jours billes tables chaises poires fleurs stylos'.split(' ');
  const APOS = ["l'ami", "j'ai", "d'abord", "qu'il", "c'est", "n'est", "s'il", "m'a", "l'été", "j'aime", "t'attends", "d'un", "l'heure", "qu'elle", "n'a", "l'arbre"];
  const HYPH = ['vas-tu', 'dis-moi', 'est-ce', 'porte-clés', 'arc-en-ciel', 'rendez-vous', 'week-end', 'grand-mère', 'après-midi', 'toi-même', 'là-bas', 'peut-être', 'sous-sol', 'lis-moi'];
  const SLASH = ['et/ou', '1/2', '24/7', '12/05', 'km/h', 'oui/non', '3/4', 'n/a', 'jour/nuit', '05/06/2026'];

  const LEFT = 'azertqsdfgwxcvb';
  const RIGHT = 'yuiophjklmn';
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

  // Majuscule initiale, sauf pour les mots qui commencent par une lettre accentuée
  // (É, Â... ne se tapent pas simplement sur AZERTY : on ne les enseigne pas).
  const cap = (w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w);

  // ---- Générateurs -----------------------------------------------------------
  const T = {
    WORDS,
    PLAIN,
    SIMPLE,
    SENTENCES,
    NAMES,
    NAMES_PLAIN,
    CITIES,
    PASSAGES,
    LEFT,
    RIGHT,
    LETTERS,
    cap,
  };

  // Suite de 'n' mots différents d'une liste, séparés par des espaces.
  T.pick = function (list, n) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 20) {
      const w = rnd.pick(list);
      if (out[out.length - 1] !== w) out.push(w);
    }
    return out;
  };

  // Jusqu'à atteindre ~len caractères.
  T.fill = function (list, len, fn) {
    const out = [];
    let total = 0;
    let guard = 0;
    while (total < len && guard++ < 500) {
      let w = rnd.pick(list);
      if (fn) w = fn(w);
      if (out[out.length - 1] === w) continue;
      out.push(w);
      total += w.length + 1;
    }
    return out.join(' ');
  };

  // Groupes de 2 à 4 caractères tirés de 'chars', avec une préférence pour 'focus'.
  T.drill = function (chars, len, focus) {
    const pool = Array.from(chars);
    const f = Array.from(focus || '');
    const out = [];
    let total = 0;
    while (total < len) {
      const n = rnd.int(2, 4);
      let g = '';
      for (let i = 0; i < n; i++) g += f.length && Math.random() < 0.6 ? rnd.pick(f) : rnd.pick(pool);
      if (out[out.length - 1] === g) continue;
      out.push(g);
      total += g.length + 1;
    }
    return out.join(' ');
  };

  // Mélange de vrais mots (tous écrits avec 'chars') et de séries de lettres.
  T.mix = function (o) {
    const chars = o.chars;
    const focus = o.focus || '';
    const len = o.len || 80;
    const pool = o.pool || PLAIN;
    const real = o.real == null ? 0.7 : o.real;
    const set = new Set(Array.from(chars));
    const cands = pool.filter((w) => Array.from(w).every((c) => set.has(c)));
    const withFocus = focus ? cands.filter((w) => Array.from(w).some((c) => focus.includes(c))) : cands;
    const out = [];
    let total = 0;
    let guard = 0;
    while (total < len && guard++ < 800) {
      let tok;
      if (cands.length >= 8 && Math.random() < real) {
        const src = withFocus.length >= 4 && Math.random() < 0.75 ? withFocus : cands;
        tok = rnd.pick(src);
      } else {
        tok = T.drill(chars, 4, focus).split(' ')[0];
      }
      if (out[out.length - 1] === tok) continue;
      out.push(tok);
      total += tok.length + 1;
    }
    return out.join(' ');
  };

  // Chiffres : groupes de 2 à 4 chiffres.
  T.digits = function (chars, len, focus) {
    const pool = Array.from(chars);
    const f = Array.from(focus || '');
    const out = [];
    let total = 0;
    while (total < len) {
      const n = rnd.int(2, 4);
      let g = '';
      for (let i = 0; i < n; i++) g += f.length && Math.random() < 0.55 ? rnd.pick(f) : rnd.pick(pool);
      if (out[out.length - 1] === g) continue;
      out.push(g);
      total += g.length + 1;
    }
    return out.join(' ');
  };

  // Nombres dans des mini-phrases : dates, prix, téléphones, quantités.
  T.numbers = function (len) {
    const out = [];
    let total = 0;
    const two = () => String(rnd.int(10, 99));
    while (total < len) {
      const k = rnd.int(0, 4);
      let s;
      if (k === 0) s = 'le ' + rnd.int(1, 28) + ' ' + rnd.pick(MONTHS) + ' ' + rnd.int(1990, 2029);
      else if (k === 1) s = rnd.int(2, 40) + ' ' + rnd.pick(NOUNS_PL);
      else if (k === 2) s = '0' + rnd.int(1, 9) + ' ' + two() + ' ' + two() + ' ' + two() + ' ' + two();
      else if (k === 3) s = rnd.int(1, 9) + ' ' + String(rnd.int(0, 999)).padStart(3, '0') + ' euros';
      else s = 'à ' + rnd.int(6, 22) + ' h ' + String(rnd.pick([0, 15, 30, 45])).padStart(2, '0');
      out.push(s);
      total += s.length + 1;
    }
    return out.join(' ');
  };

  // Majuscules en début de mot, selon la main du premier caractère.
  T.capsWords = function (side, len) {
    const set = side === 'L' ? LEFT : RIGHT;
    const list = PLAIN.filter((w) => set.includes(w[0]) && w.length >= 3);
    return T.fill(list, len, cap);
  };

  // Signes de ponctuation dans des mots : 'marks' = liste de jetons ('.', ',', '?', ...).
  T.punct = function (marks, len) {
    const out = [];
    let total = 0;
    let start = true;
    let n = 0;
    while (total < len) {
      const pool = start ? PLAIN : WORDS;
      let w = rnd.pick(pool.filter((x) => x.length > 2 && x.length < 9));
      if (start) w = cap(w);
      start = false;
      n++;
      let tok = w;
      const r = Math.random();
      if (n >= 2 && r < 0.45) {
        const m = rnd.pick(marks);
        if (m === '.' || m === '?' || m === '!') {
          start = true;
          n = 0;
        }
        const french = m === '?' || m === '!' || m === ';' || m === ':';
        tok = w + (french ? ' ' : '') + m;
      }
      out.push(tok);
      total += tok.length + 1;
    }
    return out.join(' ');
  };

  // Phrases complètes tirées de la liste (jusqu'à ~len caractères).
  T.sentenceArr = function (list, len) {
    const idx = rnd.shuffle(list.map((_, i) => i));
    const out = [];
    let total = 0;
    for (const i of idx) {
      if (total >= len) break;
      out.push(list[i]);
      total += list[i].length + 1;
    }
    return out;
  };
  T.sentences = (list, len) => T.sentenceArr(list, len).join(' ');

  // Entraînement sur les points faibles : 'weak' = liste de caractères ratés.
  T.weak = function (weak, len) {
    len = len || 220;
    const layout = DD.Layout.current();
    const letters = [];
    const symbols = [];
    weak.forEach((c) => {
      const lc = c.toLowerCase();
      if (/^[a-zàâçéèêëîïôùûü]$/.test(lc)) letters.push(lc);
      else if (c !== ' ' && layout.hint(c)) symbols.push(c);
    });
    const wantUpper = weak.some((c) => /^[A-Z]$/.test(c));
    const parts = [];
    let total = 0;
    const focusAll = letters.join('');
    const wordsWith = WORDS.filter((w) => Array.from(w).some((c) => focusAll.includes(c)) && w.length >= 3);
    const score = (w) => Array.from(w).filter((c) => focusAll.includes(c)).length;
    wordsWith.sort((a, b) => score(b) - score(a) || a.length - b.length);
    const top = wordsWith.slice(0, Math.max(12, Math.min(60, wordsWith.length)));
    while (total < len) {
      let tok;
      const r = Math.random();
      if (letters.length && top.length && (r < 0.6 || !symbols.length)) {
        tok = rnd.pick(top);
        if (wantUpper && Math.random() < 0.3) tok = cap(tok);
      } else if (symbols.length) {
        const s = rnd.pick(symbols);
        const base = rnd.pick(PLAIN.filter((w) => w.length <= 5));
        if (/[0-9]/.test(s)) tok = String(rnd.int(1, 9)) + s + String(rnd.int(10, 99));
        else if ('()"'.includes(s)) tok = s === '(' || s === ')' ? '(' + base + ')' : '"' + base + '"';
        else tok = base + s;
      } else {
        tok = rnd.pick(PLAIN);
      }
      if (parts[parts.length - 1] === tok) continue;
      parts.push(tok);
      total += tok.length + 1;
    }
    return parts.join(' ');
  };

  T.APOS = APOS;
  T.HYPH = HYPH;
  T.SLASH = SLASH;

  DD.Text = T;
})();
