# Subitis — landing pages

Deux pages, un même socle, zéro dépendance :

| Fichier | Rôle |
| --- | --- |
| **`index.html`** | La landing **généraliste** : recruter des professionnels de la beauté (barbier, coiffure, esthétique, onglerie, maquillage) pour qu'ils testent la plateforme d'abonnement. |
| `marseille.html` | L'ancienne landing du pilote Marseille (pros mobiles), conservée telle quelle. |

**Chaque fichier est entièrement autonome.** Aucun framework, aucune étape de build, aucune
requête réseau — les polices sont embarquées en base64. On l'ouvre, on le modifie, on le publie.
Seule `marseille.html` a besoin du dossier `photos/` ; `index.html` n'a **aucune image** : les
écrans du produit sont dessinés en HTML/CSS.

---

## Les deux valeurs à renseigner avant de publier

Le fichier est complet, sauf deux valeurs que je ne peux pas inventer. Elles sont marquées dans
le code, et **la page refuse de mentir tant qu'elles manquent**.

### 1. L'identifiant Google Analytics 4

Dans le `<head>`, remplacer `G-XXXXXXXXXX` par l'identifiant réel.

Tant que la valeur commence par `G-X`, un garde coupe le chargement : **aucun appel n'est émis
vers Google**. Pas de fausse balise en production, rien à déclarer côté RGPD.

Ensuite : **republier**. C'est l'oubli classique — une balise collée en local ne remonte pas.
Vérifier dans **GA4 → Rapports → Temps réel**, en navigation privée.

Les événements câblés sur `index.html` :

| Événement | Déclenché quand | Sert à |
| --- | --- | --- |
| `essai_pro` | un professionnel envoie le formulaire d'essai | KPI n° 1 — inscriptions |
| `calcul_manque_a_gagner` | le calculateur est manipulé (une fois par visite, avec les valeurs réglées) | mesurer si l'argument central accroche |

(`marseille.html` garde ses trois événements historiques : `candidature_pro`,
`interet_cliente`, `demande_cliente`.)

### 2. La destination du formulaire

Dans le `<script>` en bas de page :

```js
const ENDPOINT = '';
```

| Option | Adresse | Pourquoi |
| --- | --- | --- |
| **HubSpot** | `https://api.hsforms.com/submissions/v3/integration/submit/<portalId>/<formId>` | Le lien CRM est natif |
| Formspree | `https://formspree.io/f/<identifiant>` | Deux minutes à mettre en place |
| Tally | `https://tally.so/r/<identifiant>` | Idem |

**Tant que `ENDPOINT` est vide, rien n'est envoyé et la page le dit.** Elle affiche un
avertissement explicite au lieu d'un « merci » mensonger. Une demande d'essai perdue sans que
personne ne le sache est pire que pas de formulaire.

Après l'avoir renseigné : **republier, envoyer une vraie demande de test, vérifier qu'elle
arrive.**

### À valider aussi avant publication

Les prix **Classique 19 €/mois** et **Premium 39 €/mois** viennent du Business Model Canvas
(`plan-landing/SUBITIS_BMC_Abonnement.pdf`), qui les marque lui-même « à valider » — c'est
précisément le doute n° 1 du J1. Ils sont signalés en commentaire HTML dans la section
`#offres`. Si les entretiens tranchent d'autres montants, penser aussi au calculateur
(l'équivalence « Soit N fois l'abonnement Classique à 19 € » est calculée en JS) et au
comparatif (« l'abonnement en coûte 19 »).

---

## Publier

```bash
npx vercel --prod          # ou : Settings → Pages → Source main / racine sur GitHub
```

**Tester le lien en navigation privée** avant de le diffuser. Un lien qui ne marche que sur la
machine qui l'a créé vaut zéro.

## Vérifier

```bash
node outils/verifier.mjs                 # vérifie index.html
node outils/verifier.mjs marseille.html  # vérifie la page du pilote
```

Ouvre un vrai Chromium (emprunté à `c:/Users/telmat/Desktop/hackaton-app`) et contrôle, en une
passe :

- **aucun défilement horizontal** de 320 à 1440 px (8 largeurs)
- **cibles tactiles ≥ 44 px**, un seul `h1`, aucun saut de niveau, tout champ nommé
- **contraste WCAG mesuré** sur ~150 couples texte/fond, fonds translucides composés
- les **invariants de contenu** mot pour mot, et l'absence de tout nom de place de marché à
  commission (le contre-positionnement attaque le modèle, pas une enseigne)
- le **calculateur** : 45 € × 3 × 4 = 540 par défaut, recalcul instantané, formatage des
  grands montants, événement GA4 émis une seule fois, `aria-live` présent
- les **cinq écrans de téléphone** : `role="img"` + description, aucun élément interactif ni
  titre dans les interfaces factices
- le formulaire **avertit** au lieu de simuler un envoi réussi
- **aucune transition au-delà de 300 ms**, mouvement réduit respecté
- **aucune requête vers l'extérieur** — les polices sont dans le fichier
- impression : curseurs remplacés par la phrase-exemple, compteur figé à 540, PDF généré
- **navigation clavier** : chaque arrêt montre son contour, la FAQ s'ouvre à Entrée

Il produit aussi `apercu/landing-{390,768,1280}.png` et `apercu/subitis-landing.pdf`
(`marseille-*.png` et `marseille.pdf` pour l'autre page).

## Regénérer les polices

```bash
node outils/embarquer-polices.mjs
```

Ce n'est **pas** une étape de build : les fichiers sont livrés complets. Ce script ne sert qu'à
refaire l'opération si l'on change de police.

---

## Ce que contient `index.html`

Hero (texte + **écran d'agenda qui se remplit**) · le **calculateur de manque à gagner** ·
trois douleurs / trois écrans (réservation 24 h/24, annulations gérées, page référencée) ·
comment ça marche en trois étapes · **le modèle** (fond encre : les trois chiffres du marché,
commission vs abonnement chiffré sur 60 €, écran des prix) · les trois offres (Classique 19 € /
Premium 39 € — à valider / sur devis) · engagements + FAQ des vraies objections · le
formulaire d'essai · le pied de page.

Le contenu s'appuie sur les documents de `plan-landing/` (BMC abonnement, fiche marché,
personas) : les prix, les chiffres du marché (27 000 coiffeurs à domicile, revenu moyen sous
le SMIC, commission du leader passée de 16 % à 25 %), l'exemple du comparatif (60 € → 45 €
après commission) et les objections de la FAQ (« J'ai déjà Instagram », « Je ne veux pas être
noté », « Pas le temps d'un nouvel outil ») viennent de là, pas de l'imagination.

## Les décisions qui ont une raison

**Aucune photo de persona.** Une photo de barbier braque l'esthéticienne, et inversement. Ce que
la page montre, c'est **le produit** : cinq écrans de l'application dessinés en pur HTML/CSS,
dans des coques de téléphone qui déclinent le double-liseré maison. Aucune capture d'écran non
plus — l'application porte encore l'ancien nom.

**Le chiffre-choc n'est pas inventé, il est calculé par le visiteur.** « Vos créneaux valent
X € » est faux par nature : un barbier à 15 € et une prothésiste à 80 € ne perdent pas la même
chose. Le calculateur (prix moyen × créneaux vides × 4 semaines) rend le chiffre personnel —
et la page le dit explicitement. Défaut : 45 € × 3 = 540 €/mois, l'ancre héritée du brief.

**Le contre-positionnement attaque le modèle, pas une enseigne.** Exemple générique au taux de
25 %, courant sur les places de marché beauté ; aucun concurrent à commission n'est nommé (le
vérificateur y veille). Planity, qui est un abonnement, est traité en FAQ — sur le prix.

**Les étoiles vivent dans l'interface, pas dans la page.** Le 4,9 (48 avis) de l'écran D est
une fonctionnalité du produit (le module d'avis), présentée dans une interface factice décrite
comme telle. La page elle-même n'affiche **aucune traction** : pas de compteur d'inscrits, pas
de témoignage — « Subitis démarre » est assumé dans la section engagements.

**La visibilité n'est jamais « des clients garantis ».** La formulation exacte, partout : « une
page de réservation professionnelle, référencée, à votre nom ».

**Interfaces factices, règles dures.** Aucun `a`, `button`, `input` ni titre dans les écrans
dessinés (sinon cibles tactiles, focus et hiérarchie de titres cassent) ; les noms de clients
sont des barres neutres ; chaque écran porte `role="img"` et une description complète.

**Palette, typographie et double-liseré identiques au produit et à `marseille.html`.** Les deux
landings et l'application doivent se reconnaître.

## Limites connues

- Les prix (19 € / 39 €) sont ceux du BMC, à valider par les entretiens — voir plus haut.
- Les écrans dessinés ne remplaceront jamais une vraie capture : quand l'application sera
  renommée, une capture réelle dans la coque de téléphone sera le meilleur argument.
- Les polices sont embarquées en latin de base uniquement. Un prénom en cyrillique ou en grec
  retomberait sur la police système.
- `outils/verifier.mjs` emprunte Playwright à `c:/Users/telmat/Desktop/hackaton-app` : si ce
  dépôt bouge, ajuster la ligne `createRequire` en tête de script.
