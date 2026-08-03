# Subitis — landing page

One pager de recrutement des professionnels de la beauté qui se déplacent, pilote Marseille.
Livrable J2 de la Startup Week.

**Un seul fichier : `index.html`.** Aucun framework, aucune dépendance, aucune étape de build.
On l'ouvre, on le modifie, on le publie.

---

## Les deux choses à faire avant de publier

Le fichier est complet, sauf deux valeurs que je ne peux pas inventer. Elles sont marquées
dans le code et **la page refuse de mentir tant qu'elles manquent**.

### 1. L'identifiant Google Analytics 4

Dans le `<head>`, remplacer les deux occurrences de `G-XXXXXXXXXX` par l'identifiant réel.

Tant que la valeur commence par `G-X`, **aucun appel n'est émis vers Google** : le garde
`startsWith('G-X')` coupe le chargement. Pas de fausse balise en production, pas de requête
inutile.

Ensuite : **republier**. C'est l'oubli classique — une balise collée en local ne remonte pas
dans GA4. Vérifier dans **GA4 → Rapports → Temps réel**, en navigation privée.

### 2. La destination du formulaire

Dans le `<script>` en bas de page :

```js
const ENDPOINT = '';
```

Trois options, par ordre de préférence :

| Option | Adresse | Pourquoi |
| --- | --- | --- |
| **HubSpot** | `https://api.hsforms.com/submissions/v3/integration/submit/<portalId>/<formId>` | Le lien CRM est natif. La capture d'écran du J3 est acquise sans étape de plus |
| Formspree | `https://formspree.io/f/<identifiant>` | Deux minutes à mettre en place, à relier à HubSpot par Make au J3 |
| Tally | `https://tally.so/r/<identifiant>` | Idem |

**Tant que `ENDPOINT` est vide, le formulaire n'envoie rien et le dit.** Il affiche un
avertissement explicite au lieu d'un « merci » mensonger. Un faux message de succès, c'est une
candidature perdue sans que personne ne le sache — et la consigne du J2 liste précisément
« ça marche sans preuve » comme une erreur.

Après avoir renseigné l'adresse : **republier, envoyer une vraie candidature de test, et
vérifier qu'elle arrive.**

---

## Publier

### Vercel

```bash
npx vercel --prod
```

Répondre aux questions, accepter les valeurs par défaut. L'URL rendue est celle qui part dans
Tally.

### GitHub Pages

Pousser le dépôt, puis **Settings → Pages → Source : `main` / racine**. L'URL est disponible
en une minute.

Dans les deux cas : **tester le lien en navigation privée** avant de le déposer. Un lien qui ne
marche que sur la machine qui l'a créé vaut zéro.

---

## Le PDF du livrable

`Ctrl+P` → **Orientation paysage** → Destination **Enregistrer au format PDF**.

Les règles d'impression sont déjà écrites : la barre de navigation disparaît, les blocs à
révélation sont forcés visibles (`beforeprint`), les colonnes se resserrent, et les fonds
sombres sont conservés via `print-color-adjust`.

Si Chrome propose « Graphismes d'arrière-plan », **le cocher** : sans cela les deux sections
sur fond encre sortent en blanc.

---

## Ce que contient la page

Hero · le problème en trois blocs chiffrés · comment ça marche en trois étapes ·
**ce qu'on ne fait pas** (le contre-positionnement, la section la plus importante) · le prix ·
pourquoi nous faire confiance · le formulaire · le test côté demande · le pied de page.

Le contenu vient mot pour mot de `hackathon/J2/BRIEF-LANDING-PAGE.md`. Il n'a pas été
reformulé.

**Une seule page, aucune sous-page** — la consigne sanctionne les sites multi-pages.
Le seul lien sortant est la source Wecasa, en `nofollow`.

## Détails d'implémentation qui ont une raison

- **Le formulaire qualifie l'ICP** : la question « vous déplacez-vous chez la cliente ? » est
  dans le formulaire, pas dans l'appel de rappel. Un « non » sort de la cible et on le sait
  avant de décrocher.
- **Anti-spam sans captcha** : un pot de miel invisible et un délai minimal de saisie de 1,5 s.
  Un captcha ferait chuter la conversion sur le canal principal (message privé Instagram).
- **Le clic sur le test côté demande émet un événement GA4 distinct** (`interet_cliente`).
  C'est la première donnée mesurée sur l'appétence des clientes, et elle nourrit le dashboard
  du J4.
- **Aucun chiffre inventé.** 540 €, 6 500 €, 35 à 60 €, 29 €, 25 % Wecasa : tous viennent du
  brief. Le taux Wecasa est sourcé et le lien est cliquable.
- **Aucune traction affichée.** Pas de compteur d'inscrits, pas de témoignage, pas de logo.
  L'équipe démarre à zéro.
- Palette, typographie et double-liseré identiques au produit : le jury verra les deux à la
  suite vendredi, ils doivent se reconnaître.
