# Subitis — landing page

One pager de recrutement des professionnels de la beauté qui se déplacent, pilote Marseille.
Livrable J2 de la Startup Week.

**Un seul fichier : `index.html`, 187 Ko, entièrement autonome.** Aucun framework, aucune
dépendance, aucune étape de build, aucune requête réseau. On l'ouvre, on le modifie, on le
publie.

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

Trois événements sont déjà câblés :

| Événement | Déclenché quand | Sert à |
| --- | --- | --- |
| `candidature_pro` | un professionnel envoie le formulaire | KPI n° 1 — inscriptions |
| `interet_cliente` | ouverture du bloc « je cherche une prestation » | **KPI n° 3 — signal de demande** |
| `demande_cliente` | le mini-formulaire de demande est envoyé | qualifie ce même signal |

### 2. La destination des formulaires

Dans le `<script>` en bas de page :

```js
const ENDPOINT = '';
```

| Option | Adresse | Pourquoi |
| --- | --- | --- |
| **HubSpot** | `https://api.hsforms.com/submissions/v3/integration/submit/<portalId>/<formId>` | Le lien CRM est natif. La capture d'écran du J3 est acquise sans étape de plus |
| Formspree | `https://formspree.io/f/<identifiant>` | Deux minutes, à relier à HubSpot par Make au J3 |
| Tally | `https://tally.so/r/<identifiant>` | Idem |

**Tant que `ENDPOINT` est vide, rien n'est envoyé et la page le dit.** Elle affiche un
avertissement explicite au lieu d'un « merci » mensonger. Une candidature perdue sans que
personne ne le sache est pire que pas de formulaire — et la consigne du J2 liste « ça marche
sans preuve » parmi les erreurs sanctionnées.

Après l'avoir renseigné : **republier, envoyer une vraie candidature de test, vérifier qu'elle
arrive.**

---

## Publier

```bash
npx vercel --prod          # ou : Settings → Pages → Source main / racine sur GitHub
```

**Tester le lien en navigation privée** avant de le déposer dans Tally. Un lien qui ne marche
que sur la machine qui l'a créé vaut zéro.

## Le PDF du livrable

`Ctrl+P` → **paysage** → **Enregistrer au format PDF**. Environ 7 pages.

Cocher **« Graphismes d'arrière-plan »** : sans cela, les deux sections sur fond encre sortent
en blanc.

Tout est déjà prévu : la barre de navigation et l'appel collant disparaissent, les blocs à
révélation sont forcés visibles, le compteur du hero est figé à 540, les colonnes se resserrent.
Un PDF prêt est aussi généré automatiquement dans `apercu/subitis-landing.pdf`.

---

## Vérifier

```bash
node outils/verifier.mjs
```

Ouvre un vrai Chromium et contrôle, en une passe :

- **aucun défilement horizontal** de 320 à 1440 px (8 largeurs)
- **cibles tactiles ≥ 44 px**, un seul `h1`, aucun saut de niveau, tout champ nommé
- **contraste WCAG mesuré** sur une centaine de couples texte/fond, avec les ratios réels
- **les 15 phrases imposées par le brief**, mot pour mot
- aucune trace de l'ancien positionnement, aucun emoji, aucun mot creux
- le **bloc de demande** s'ouvre, émet son événement GA4 et donne le focus au premier champ
- les formulaires **avertissent** au lieu de simuler un envoi réussi
- **aucune transition au-delà de 300 ms**, mouvement réduit respecté
- **aucune requête vers l'extérieur** — les polices sont dans le fichier
- impression : rien de vide, compteur figé, PDF généré
- **navigation clavier** : chaque arrêt montre son contour de focus

Il produit aussi `apercu/landing-{390,768,1280}.png`.

## Regénérer les polices

```bash
node outils/embarquer-polices.mjs
```

Ce n'est **pas** une étape de build : `index.html` est livré complet. Ce script ne sert qu'à
refaire l'opération si l'on change de police.

---

## Ce que contient la page

Hero · **l'inventaire périssable** (une semaine de créneaux dont trois s'éteignent, et
l'addition qui aboutit à 540 €) · deux constats · comment ça marche en trois étapes ·
**ce qu'on ne fait pas** avec le comparatif chiffré Wecasa · le prix · pourquoi nous faire
confiance · le formulaire · le test côté demande · le pied de page.

Le contenu vient mot pour mot de `hackathon/J2/BRIEF-LANDING-PAGE.md`. Il n'a pas été reformulé.

**Une seule page, aucune sous-page.** Le seul lien sortant est la source Wecasa, en `nofollow`.

## Les décisions qui ont une raison

**L'inventaire périssable est dessiné, pas décrit.** Trois créneaux sur vingt s'éteignent sous
les yeux, et l'addition fait le calcul : `3 × 45 € × 4 semaines = 540 €`. C'est la thèse rendue
visible, et personne d'autre ne l'aura.

**Le contre-positionnement est démontré, pas affirmé.** Sur une prestation à 45 €, la commission
Wecasa prélève 11,25 € — il reste 33,75 € au lieu de 45. Sur 12 prestations, elle prélève 135 €
quand l'abonnement en coûte 29. **Dès la troisième prestation du mois, l'abonnement revient moins
cher que la commission.** Tous ces chiffres dérivent du brief, aucun n'est inventé.

**Le formulaire qualifie l'ICP.** La question « vous déplacez-vous chez la cliente ? » est dans
le formulaire, pas dans l'appel de rappel. Un « non » sort de la cible avant qu'on décroche.

**Anti-spam sans captcha** : un pot de miel invisible et un délai minimal de saisie de 1,5 s. Un
captcha ferait chuter la conversion sur le canal principal, le message privé Instagram.

**Aucune traction affichée.** Pas de compteur d'inscrits, pas de témoignage, pas de logo de
presse. L'équipe démarre à zéro et la page ne prétend pas le contraire.

**Palette, typographie et double-liseré identiques au produit.** Le jury verra la landing puis
l'application : les deux doivent se reconnaître.

## Limites connues

- La page fait 9 écrans sur mobile. C'est long, mais chaque section répond à une objection
  identifiée. À raccourcir seulement si la mesure montre un abandon avant le formulaire.
- Aucune capture du produit n'est intégrée : l'application porte encore l'ancien nom. À ajouter
  après son renommage — ce sera le meilleur argument de la page.
- Les polices sont embarquées en latin de base uniquement. Un prénom en cyrillique ou en grec
  retomberait sur la police système.
