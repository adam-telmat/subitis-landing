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

> [!IMPORTANT]
> **La page est en ligne, mais elle ne collecte encore rien.** Les deux valeurs ci-dessous sont
> toujours des marqueurs : aucune mesure ne remonte dans GA4, et le formulaire d'essai avertit
> le visiteur au lieu d'envoyer sa demande. C'est le comportement voulu — la page refuse de
> simuler un succès — mais tant que `ENDPOINT` est vide, **une demande d'essai est perdue**.
> À renseigner puis republier (un `git push` suffit) avant de diffuser le lien.

## Les deux valeurs à renseigner avant de publier

Le fichier est complet, sauf deux valeurs que je ne peux pas inventer. Elles sont marquées dans
le code, et **la page refuse de mentir tant qu'elles manquent**.

### 1. Google Analytics 4 — fait

`G-FTJR72W7GL`, propriété « Subitis », flux « Landing Subitis » pointant sur
`https://subitis-landing.vercel.app/`. Le flux et la page doivent viser la même adresse, sinon
les données se rattachent au mauvais site.

Pas de Google Tag Manager : une seule balise, le code est déjà en place, et c'est l'équipe qui
édite le dépôt. GTM n'ajouterait qu'une requête et un point de panne.

| Événement | Déclenché quand | Paramètres |
| --- | --- | --- |
| `cta_hero` | clic sur l'appel à l'action du hero | — |
| `inscription_pro` | soumission **réussie** du formulaire | `metier`, `zone`, `canal_prefere` |
| `calcul_manque_a_gagner` | le calculateur est manipulé, une fois par visite | `prix_moyen`, `creneaux_vides`, `total_mensuel` |

`inscription_pro` part **après** la réponse du serveur, jamais au clic : compter les intentions
comme des inscriptions gonflerait le taux de conversion, et c'est précisément l'écart entre
`cta_hero` et `inscription_pro` qui dit si le blocage vient de la page ou du formulaire.

> **Le quatrième événement du brief, `recherche_cliente`, n'existe pas ici.** Il s'attache au
> bloc « vous cherchez une prestation à domicile ? », qui vit sur `marseille.html` : la page
> généraliste ne s'adresse qu'aux professionnels. Voir « Ce que le brief J3 suppose » plus bas.

### 1 bis. L'ancien mode d'emploi de l'identifiant

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

**Branché le 5 août 2026** sur le scénario Make « Formulaire Subitis ».

### Le filet : aucune inscription perdue pendant une panne

Le webhook peut être coupé — il l'était encore ce matin (`410 There is no scenario listening`),
et il le sera à chaque maintenance. Une inscription qui n'a pas pu partir est donc **gardée sur
l'appareil du visiteur** et rejouée à sa prochaine visite, en silence : il a déjà été prévenu
de l'échec, le reprendre à partie n'apporterait rien.

Les garde-fous : rien ne transite ailleurs que vers le webhook, rien n'est gardé plus de
**sept jours**, et **cinq entrées au maximum** — passé ce point ce n'est plus une panne
passagère, et le stock n'aiderait personne. Si le stockage est indisponible (navigation privée,
espace saturé), l'envoi se poursuit sans filet plutôt que d'échouer.

Ce mécanisme est éprouvé par quatre contrôles : l'inscription est gardée, ses données sont
intactes, elle repart seule au rechargement, et la file se vide une fois transmise.

**Si `ENDPOINT` redevient vide, rien n'est envoyé et la page le dit.** Une inscription perdue
sans que personne ne le sache est pire que pas de formulaire.

Deux messages, deux publics : le visiteur lit « les inscriptions ne sont pas encore
ouvertes », phrase qui lui parle et qui ne l'accuse de rien ; la consigne technique part dans
la console du navigateur, là où on la cherche. Sur un site en ligne, un message destiné au
développeur s'afficherait à un professionnel qui vient de remplir sept champs.

### Ce qu'il reste à faire côté Make

Au 5 août, le scénario **n'écoute pas** : le webhook répond `410 There is no scenario listening
for this webhook`, vérifié depuis la page publiée et par un appel direct. La page se comporte
correctement — message d'erreur, aucune confirmation, inscription mise en file — mais rien
n'arrive dans le CRM.

Pour le débloquer, dans le scénario « Formulaire Subitis » : **« Run once »** pour capter un
seul appel de test, ou l'interrupteur **ON** pour écouter en permanence.

La charge envoyée, aux noms de clés attendus par l'automatisation :

```json
{
  "prenom": "Karim",       "nom": "Benali",
  "metier": "Barbier",
  "zone": "Marseille 3e",  "email": "karim@exemple.fr",
  "telephone": "0612345678",
  "instagram": "@karim.barber", "tiktok": "", "facebook": "",
  "canal_prefere": "Instagram",
  "source": "landing",
  "horodatage": "2026-08-05T09:41:12.000Z"
}
```

Côté Make, `prenom` et `nom` se mappent sur les champs HubSpot **`firstname`** et
**`lastname`**. Sans le nom, la fiche contact reste incomplète, le dédoublonnage devient
approximatif et les relances s'adressent à un prénom seul.

> [!WARNING]
> **`se_deplace` a été retiré du formulaire, à la demande du fondateur.** Le brief J3 en
> faisait son « chantier 0 » : c'était le critère de qualification de l'ICP, et surtout la
> **branche du routeur Make**. Sans lui, l'automatisation transporte au lieu de trier, et le
> critère de recette « le champ part dans la charge en booléen » ne peut plus être coché.
>
> Aucune valeur par défaut n'est envoyée à sa place : classer tout le monde du même côté du
> routeur serait pire que l'absence. Si le tri redevient nécessaire, le champ se remet en
> quelques minutes — voir le commit qui l'a retiré.

Deux garde-fous déjà en place, à ne pas retirer : le bouton se désactive pendant l'envoi et ne
se réactive **qu'en cas d'échec**, donc un double clic ne peut pas créer deux contacts ; et
aucun message de confirmation n'est affiché tant que le serveur n'a pas répondu favorablement.

## Ce que le brief J3 suppose, et qui n'est plus vrai

Le brief technique du J3 décrit la page telle qu'elle était au J2 : une place de marché pour
les professionnels **qui se déplacent**, à Marseille, hébergée sur GitHub Pages. Trois écarts
en découlent, à connaître avant de cocher la recette :

| Le brief suppose | La page aujourd'hui |
| --- | --- |
| GitHub Pages, `adam-telmat.github.io` | Vercel, `subitis-landing.vercel.app` |
| Un bloc « vous cherchez une prestation ? » côté clientes | La page ne s'adresse qu'aux professionnels ; ce bloc est resté sur `marseille.html` |
| Le message « ouvrir vos premiers créneaux » | « ouvrir votre accès d'essai » — la page vend un abonnement, pas un pilote |

**Conséquence sur l'événement `recherche_cliente`.** Le brief le désigne comme le plus
important des trois : c'est le seul instrument qui mesure la demande côté clientes, donc le
doute qui peut arrêter le projet. Il ne peut pas être posé sur cette page sans y ramener un
bloc destiné aux clientes, ce qui brouillerait un discours entièrement construit pour les
professionnels. Deux issues possibles, à trancher :

1. **Le poser sur `marseille.html`**, où le bloc existe déjà, et publier cette page en parallèle
   sur une seconde adresse.
2. **Ramener un bloc court côté clientes** en bas de la page généraliste, assumé comme une
   mesure de la demande et non comme une offre.

### À valider aussi avant publication

Les prix **Classique 19 €/mois** et **Premium 39 €/mois** viennent du Business Model Canvas
(`plan-landing/SUBITIS_BMC_Abonnement.pdf`), qui les marque lui-même « à valider » — c'est
précisément le doute n° 1 du J1. Ils sont signalés en commentaire HTML dans la section
`#offres`. Si les entretiens tranchent d'autres montants, penser aussi au calculateur
(l'équivalence « Soit N fois l'abonnement Classique à 19 € » est calculée en JS) et au
comparatif (« l'abonnement en coûte 19 »).

---

## En ligne

**https://subitis-landing.vercel.app**

Projet Vercel `subitis-landing` (compte `adam-telmat`), relié à la branche `main` de
`github.com/adam-telmat/subitis-landing`. **Chaque push sur `main` redéploie automatiquement** —
il n'y a rien à lancer à la main.

Ce qui est servi publiquement se limite à `index.html`, par le `.vercelignore` : il exclut tout
par défaut et ne réintègre que la landing. Sont donc hors ligne, et c'est voulu — les documents
internes du hackathon, les captures et le PDF de relecture, les scripts de vérification, et
`marseille.html` dont le positionnement contredirait celui de la page publiée. Pour remettre
cette dernière en ligne, ajouter `!marseille.html` au `.vercelignore`.

Après chaque déploiement, **tester le lien en navigation privée** : un lien qui ne marche que
sur la machine qui l'a créé vaut zéro. Contrôle rapide des exclusions, sans session Vercel :

```bash
node -e "for (const c of ['/','/marseille.html','/README.md','/plan-landing/']) fetch('https://subitis-landing.vercel.app'+c).then(r=>console.log(r.status,c))"
```

La racine doit répondre `200`, tout le reste `404`.

## Vérifier

```bash
node outils/verifier.mjs                 # vérifie index.html
node outils/verifier.mjs marseille.html  # vérifie la page du pilote
```

Ouvre un vrai Chromium (emprunté à `c:/Users/telmat/Desktop/hackaton-app`) et contrôle, en une
passe :

- **aucun défilement horizontal** de 320 à 1440 px (8 largeurs)
- **cibles tactiles ≥ 44 px**, un seul `h1`, aucun saut de niveau, tout champ nommé
- **contraste WCAG mesuré** sur ~215 couples texte/fond : fonds translucides composés sur la
  pile de parents, couleurs de texte translucides composées sur leur fond, et le texte propre
  de chaque élément mesuré même quand il porte une icône
- **deux familles de mouvement** : les commandes (liens, boutons, champs, `summary`) restent
  sous 300 ms, les entrées au défilement peuvent aller jusqu'à 1 s
- les **invariants de contenu** mot pour mot, et l'absence de tout nom de place de marché à
  commission (le contre-positionnement attaque le modèle, pas une enseigne)
- le **calculateur** : 45 € × 3 × 4 = 540 par défaut, recalcul instantané, formatage des
  grands montants, événement GA4 émis une seule fois, `aria-live` présent
- les **appareils dessinés** : `role="img"` + description, aucun élément interactif ni titre
  dans les interfaces factices
- la **séquence épinglée** : l'étape qui traverse le milieu du viewport pilote l'écran affiché,
  dans les deux sens de défilement, et un seul écran est actif à la fois
- le **ton** : aucun terme qui met le professionnel en faute (« lapin », « punit », « détruit »)
- le formulaire **avertit** au lieu de simuler un envoi réussi
- mouvement réduit respecté
- **aucune requête vers l'extérieur** — les polices sont dans le fichier
- impression : curseurs remplacés par la phrase-exemple, compteur figé à 540, un seul écran de
  la séquence sur le PDF, PDF généré
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

Hero (texte + **l'agenda qui se remplit sous les yeux**) · le **calculateur de manque à
gagner** · la **séquence épinglée** (un appareil, trois écrans qui se succèdent au
défilement) · **l'abonnement** (trois cartes, la Premium en avant) · comment ça marche en
trois étapes · **le modèle** (fond encre : les trois chiffres du marché, commission contre
abonnement chiffré sur 60 €, écran des tarifs) · engagements + FAQ des vraies objections ·
le formulaire d'essai · le pied de page.

**Le prix arrive tôt, juste après la démonstration.** C'est la première chose qu'on cherche
sur une page d'abonnement ; la faire attendre derrière deux sections de pédagogie fait
remonter le visiteur à contresens. Le contre-positionnement (commission contre abonnement)
vient après : il justifie un prix déjà connu au lieu de le préparer.

**Les trois offres ont la même structure** : nom, à qui elle s'adresse, prix, liste, appel.
La carte Premium est signalée par « Notre recommandation », jamais par « la plus
populaire » : nous n'avons aucune donnée d'usage, et cette page ne prétend à aucune traction.

### Ce qui sépare 19 € de 39 €

> **19 € : vous arrêtez de répondre au téléphone.
> 39 € : vous arrêtez de perdre de l'argent.**

Le premier découpage était bancal : le Classique donnait le produit entier et le Premium
ajoutait des statistiques. Personne ne paie le double pour des graphiques.

L'axe retenu vient de l'analyse de la concurrence. Planity ne publie pas ses prix (il faut
demander un devis) et sa montée en gamme ne repose pas sur la visibilité mais sur **l'argent** :
agenda, puis caisse enregistreuse certifiée, puis encaissement et terminal de paiement. Les
rappels SMS y sont un **module facturé en plus** de l'abonnement, avec un coût par message.

D'où le découpage :

| | Classique 19 € | Premium 39 € |
| --- | --- | --- |
| Ce qu'on arrête | de répondre au téléphone | de perdre de l'argent |
| Rappels | email | **SMS inclus** |
| Encaissement | — | **acompte à la réservation, paiement en ligne** |
| Reconquête | — | **relance des clients qui ne sont pas revenus** |
| Équipe | un agenda, un praticien | jusqu'à trois |
| Visibilité | page référencée, avis | profil mis en avant, fréquentation suivie |

L'écart de 20 € se défend par un **coût unitaire réel** (SMS, frais bancaires) et non par une
marge décidée au hasard. Et il vise la douleur qui coûte le plus cher : un rendez-vous oublié
vaut plus qu'un mois d'abonnement.

> [!IMPORTANT]
> **Écrire une fonctionnalité sur la page, c'est promettre qu'elle existera.** Le Premium
> engage donc le produit sur les rappels SMS, l'acompte et le paiement en ligne. Si l'un des
> trois ne se fait pas, il doit disparaître de la carte avant la diffusion. Les prix
> eux-mêmes restent ceux du Business Model Canvas, qui les marque « à valider ».

Une entrée de FAQ protège la promesse centrale : le paiement en ligne fait intervenir des
frais bancaires, qui ne sont pas les nôtres. Sans cette précision, « zéro commission » et
« paiement en ligne » se contrediraient.

Le contenu s'appuie sur les documents de `plan-landing/` (BMC abonnement, fiche marché,
personas) : les prix, les chiffres du marché (27 000 coiffeurs à domicile, revenu moyen sous
le SMIC, commission du leader passée de 16 % à 25 %), l'exemple du comparatif (60 € → 45 €
après commission) et les objections de la FAQ (« J'ai déjà Instagram », « Je ne veux pas être
noté », « Pas le temps d'un nouvel outil ») viennent de là, pas de l'imagination.

## Les décisions qui ont une raison

**Aucune photo de persona.** Une photo de barbier braque l'esthéticienne, et inversement. Ce que
la page montre, c'est **le produit** : l'application est dessinée en pur HTML/CSS — barre
d'état, grand titre, semaine, agenda, barre d'onglets, indicateur d'accueil — dans un appareil
lui aussi dessiné : châssis titane en dégradé, liseré noir, îlot, boutons de tranche, reflet de
dalle, le tout aux proportions réelles (393 × 852 pt, rayon 55 pt) et posé en perspective 3D.
Toutes ses mesures dérivent d'une seule variable `--l`. Aucune capture d'écran non plus —
l'application porte encore l'ancien nom.

**Un appareil, trois écrans, épinglé au défilement.** La section « trois moments » garde
l'appareil à l'écran pendant que les réponses défilent, et change son écran à chaque étape. On
n'éteint jamais sur la sortie, sinon plus aucune étape ne serait active en haut et en bas de la
section. Le sortant s'efface en 220 ms et l'entrant arrive 170 ms plus tard : un fondu croisé
symétrique superposerait deux mises en page et rendrait l'écran illisible une demi-seconde.

**La ligne de détection n'est pas au même endroit sur mobile et sur grand écran**, et les trois
réglages qui en dépendent tiennent ensemble :

| | Grand écran (≥ 1000 px) | Mobile |
| --- | --- | --- |
| Disposition | texte à gauche, appareil à droite | appareil épinglé en haut, texte dessous |
| Ligne de détection | milieu du viewport (`-50% / -50%`) | plus bas (`-74% / -18%`) |
| Texte dans sa boîte | centré | en haut — le déclencheur observe le haut de la boîte |
| Hauteur d'étape | 58 vh | 26 vh, la course pendant laquelle le texte reste sous l'appareil |

Sur mobile la barre d'onglets de l'interface dessinée s'efface : sous 200 px de large, quatre
libellés se chevauchent et cette hauteur sert mieux au contenu. Le vérificateur parcourt la
séquence **à la molette**, dans les deux sens, et contrôle qu'à chaque bascule le titre actif
est bien *sous* l'appareil et non derrière — un centrage artificiel testerait une géométrie que
personne ne produit en défilant.

**Les trois promesses du hero sont dimensionnées comme des titres.** `0 %`, `24 h/24`, `1` :
ce sont les seuls chiffres à retenir si le visiteur ne lit rien d'autre. En petit corps sur une
ligne, ils se lisaient comme des notes de bas de page.

**Deux familles de mouvement, et c'est délibéré.** Les commandes répondent sous 300 ms — une
commande lente est une commande cassée. Les entrées au défilement prennent 760 ms avec une
mise au point qui se fait — une apparition brutale fait cheap. Le vérificateur contrôle les
deux seuils séparément.

**Le ton vise le statu quo, jamais le professionnel.** Pas de « lapins », pas de « la
commission punit », pas de « personne ne vous trouve ». Les faits restent les mêmes, la mise en
cause disparaît. Une règle du vérificateur l'empêche de revenir.

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
  renommée, une capture réelle glissée dans la coque sera le meilleur argument de la page.
  Tout est prévu pour — il suffit de remplacer le contenu de `.tel-ecran` par une image.
- Pas de WebGL ni de framework, et c'est un choix : React, Tailwind ou Three.js coûteraient
  l'autonomie du fichier unique, le PDF du livrable et l'ouverture sans build, pour un rendu
  que le CSS 3D obtient déjà.
- Les polices sont embarquées en latin de base uniquement. Un prénom en cyrillique ou en grec
  retomberait sur la police système.
- `outils/verifier.mjs` emprunte Playwright à `c:/Users/telmat/Desktop/hackaton-app` : si ce
  dépôt bouge, ajuster la ligne `createRequire` en tête de script.
