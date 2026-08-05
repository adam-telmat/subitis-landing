/**
 * Vérification automatisée des landings, dans un vrai Chromium.
 *
 *   node outils/verifier.mjs                 → vérifie index.html (la généraliste)
 *   node outils/verifier.mjs marseille.html  → vérifie la page du pilote
 *
 * Chaque contrôle correspond à une règle de la base UI/UX Pro Max ou à un
 * invariant de la page. Un contrôle qui échoue nomme la règle : on doit
 * pouvoir décider quoi corriger sans relire tout le fichier.
 *
 * Playwright n'est pas installé ici — on emprunte celui du dépôt de
 * l'application, qui est sur la même machine.
 */

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');

const PAGE_CIBLE = process.argv[2] ?? 'index.html';
const EST_INDEX = PAGE_CIBLE === 'index.html';
const PREFIXE = EST_INDEX ? 'landing' : 'marseille';
console.log(`Cible : ${PAGE_CIBLE}`);

const PORT = 4173;
let echecs = 0;
const ok = (condition, message) => {
  console.log(`${condition ? '  ok  ' : ' ECHEC'} ${message}`);
  if (!condition) echecs += 1;
};

const serveur = createServer(async (req, res) => {
  // Les photographies vivent a cote de marseille.html : le serveur de controle
  // doit les servir, sinon les images apparaissent cassees dans les mesures.
  if (req.url && req.url.startsWith('/photos/')) {
    try {
      const bin = await readFile(join(RACINE, decodeURIComponent(req.url.slice(1))));
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return res.end(bin);
    } catch {
      res.writeHead(404);
      return res.end();
    }
  }
  const html = await readFile(join(RACINE, PAGE_CIBLE));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => serveur.listen(PORT, r));
const URL_BASE = `http://localhost:${PORT}/`;

const navigateur = await chromium.launch();

/* -------------------------------------------------------------------------- */
/*  1. Mise en page : aucun débordement horizontal                            */
/*     Règle « Layout & Responsive », sévérité HAUTE                           */
/* -------------------------------------------------------------------------- */
/* Le parc réel, du plus petit téléphone encore en circulation au 27 pouces :
   iPhone SE, Android compacts, iPhone récents, phablettes, tablettes en
   portrait et en paysage, portables, et grands écrans de bureau. Chaque
   largeur est éprouvée deux fois, en écran court et en écran haut, parce
   qu'une section calée en `vh` ne se comporte pas pareil sur les deux. */
console.log('\n— Mise en page');
const LARGEURS = [320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 912, 1024, 1180, 1280, 1366, 1440, 1600, 1920, 2560];
for (const largeur of LARGEURS) {
  for (const hauteur of largeur <= 480 ? [667, 932] : [720, 1080]) {
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur } });
    const page = await ctx.newPage();
    await page.goto(URL_BASE, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const d = await page.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
      coupables: [...document.querySelectorAll('*')]
        .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 3)
        .map((e) => `${e.tagName}.${(e.getAttribute('class') || '').slice(0, 26)}`),
    }));
    ok(
      d.s <= d.c + 1,
      `${String(largeur).padStart(4)}×${String(hauteur).padEnd(4)} : pas de défilement horizontal (${d.s} ≤ ${d.c}) ${d.coupables.join(' · ')}`,
    );
    await ctx.close();
  }
}

/* -------------------------------------------------------------------------- */
/*  Le reste des contrôles se joue sur un mobile réel (390 px, DPR 2)         */
/* -------------------------------------------------------------------------- */
const ctx = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'fr-FR',
});
const page = await ctx.newPage();
const erreursConsole = [];
page.on('console', (m) => m.type() === 'error' && erreursConsole.push(m.text()));
page.on('pageerror', (e) => erreursConsole.push(String(e)));
await page.goto(URL_BASE, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

/* -------------------------------------------------------------------------- */
/*  2. Cibles tactiles ≥ 44 px — sévérité HAUTE                               */
/* -------------------------------------------------------------------------- */
console.log('\n— Cibles tactiles');
const petites = await page.evaluate(() =>
  [...document.querySelectorAll('a, button, input:not(.pot), select, .duo label, summary')]
    // Un lien inseré dans une phrase suit la ligne de texte : lui imposer
    // 44 px casserait l'interligne. La regle vise les commandes autonomes.
    .filter((e) => !(e.tagName === 'A' && e.closest('p') && !e.classList.contains('bouton')))
    .filter((e) => !e.classList.contains('evitement'))
    .map((e) => ({ n: e.id || e.name || e.textContent.trim().slice(0, 20) || e.tagName, h: Math.round(e.getBoundingClientRect().height) }))
    .filter((x) => x.h > 0 && x.h < 44),
);
ok(petites.length === 0, `toutes les cibles font ≥ 44 px ${JSON.stringify(petites)}`);

/* -------------------------------------------------------------------------- */
/*  3. Sémantique et accessibilité — sévérité CRITIQUE                        */
/* -------------------------------------------------------------------------- */
console.log('\n— Accessibilité');
const semantique = await page.evaluate(() => {
  const titres = [...document.querySelectorAll('h1,h2,h3')].map((h) => Number(h.tagName[1]));
  let saut = null;
  for (let i = 1; i < titres.length; i += 1) {
    if (titres[i] - titres[i - 1] > 1) saut = `${titres[i - 1]} → ${titres[i]}`;
  }
  const sansNom = [...document.querySelectorAll('input:not(.pot), select')].filter((e) => {
    const parLabel = e.labels?.[0]?.textContent?.trim();
    const groupe = e.closest('[role=radiogroup]');
    return !parLabel && !e.getAttribute('aria-label') && !groupe;
  }).length;
  const imgSansAlt = [...document.querySelectorAll('img')].filter((i) => i.getAttribute('alt') === null).length;
  return {
    h1: document.querySelectorAll('h1').length,
    saut,
    sansNom,
    imgSansAlt,
    lang: document.documentElement.lang,
    main: document.querySelectorAll('main').length,
  };
});
ok(semantique.h1 === 1, `exactement un h1 (${semantique.h1})`);
ok(semantique.saut === null, `aucun saut de niveau de titre ${semantique.saut ?? ''}`);
ok(semantique.sansNom === 0, `tout champ porte un nom accessible (${semantique.sansNom} sans)`);
ok(semantique.imgSansAlt === 0, `toute image porte un alt (${semantique.imgSansAlt} sans)`);
ok(semantique.lang === 'fr', `la langue du document est déclarée (${semantique.lang})`);
ok(semantique.main === 1, 'un unique élément main');

/* Contraste WCAG réel, calculé sur les couples effectivement rendus. */
const contrastes = await page.evaluate(() => {
  // `[\d.]+`, pas `\d+` : sur « rgb(254.28, 254.04, 253.72) », la seconde
  // forme découpait sur le point décimal et lisait 254, 28, 254 — un vert
  // sombre inventé, qui faisait échouer du texte parfaitement lisible.
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Compose les fonds translucides par-dessus leur parent. Sans cela, un
  // panneau en rgba(...,0.05) sur fond encre est lu comme sa propre couleur,
  // et le calcul rend 1:1 sur du texte parfaitement lisible.
  const canaux = (c) => c.match(/[\d.]+/g).map(Number);
  const fond = (el) => {
    const pile = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        const v = canaux(c);
        const a = v.length > 3 ? v[3] : 1;
        pile.push([v[0], v[1], v[2], a]);
        if (a >= 0.999) break;
      }
      n = n.parentElement;
    }
    pile.push([255, 255, 255, 1]);
    let [r, g, b] = pile[pile.length - 1];
    for (let i = pile.length - 2; i >= 0; i -= 1) {
      const [sr, sg, sb, sa] = pile[i];
      r = sr * sa + r * (1 - sa);
      g = sg * sa + g * (1 - sa);
      b = sb * sa + b * (1 - sa);
    }
    // Arrondi : une couleur composée doit ressortir sous la même forme
    // qu'une couleur rendue par le navigateur, canaux entiers compris.
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  };
  // Un texte translucide se lit composé sur son fond, pas à sa valeur nue :
  // rgba(251,249,246,.5) n'est pas blanc, c'est le gris qui en résulte.
  const compose = (avant, arriere) => {
    const v = canaux(avant);
    const a = v.length > 3 ? v[3] : 1;
    if (a >= 0.999) return avant;
    const f = canaux(arriere);
    return `rgb(${Math.round(v[0] * a + f[0] * (1 - a))}, ${Math.round(v[1] * a + f[1] * (1 - a))}, ${Math.round(v[2] * a + f[2] * (1 - a))})`;
  };
  // Le texte PROPRE de l'élément, ses enfants exclus. L'ancienne règle
  // « aucun enfant » sautait tout libellé accompagné d'une icône — et c'est
  // exactement là que se cachait un gris trop pâle dans la barre d'onglets.
  const texteDirect = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim();

  const out = [];
  for (const el of document.querySelectorAll('p, h1, h2, h3, a, span, strong, b, em, li, dt, dd, td, th, label, button, small, output, summary')) {
    const t = texteDirect(el);
    if (!t || t.length < 2) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const px = parseFloat(s.fontSize);
    const gras = Number(s.fontWeight) >= 700;
    const seuil = px >= 24 || (px >= 18.66 && gras) ? 3 : 4.5;
    const arriere = fond(el);
    const [a, b] = [lum(compose(s.color, arriere)), lum(arriere)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    out.push({ t: t.slice(0, 30), ratio: Math.round(ratio * 100) / 100, seuil, px: Math.round(px) });
  }
  return out.sort((x, y) => x.ratio - y.ratio);
});
const sousSeuil = contrastes.filter((c) => c.ratio < c.seuil);
ok(sousSeuil.length === 0, `contraste AA sur ${contrastes.length} couples · pire : ${contrastes[0]?.ratio}:1`);
if (sousSeuil.length) console.log('        ', JSON.stringify(sousSeuil.slice(0, 6)));

/* -------------------------------------------------------------------------- */
/*  4. Invariants de contenu, mot pour mot                                    */
/* -------------------------------------------------------------------------- */
console.log('\n— Contenu');
const texte = (await page.locator('body').innerText()).replace(/\u00A0/g, ' ').replace(/[’']/g, "'");
const PHRASES_INDEX = [
  'Vos clients réservent seuls',
  'Votre agenda se remplit pendant que vous travaillez',
  'Tester Subitis',
  'Zéro commission',
  'Vos prix restent vos prix',
  'remboursé par une seule prestation',
  'page de réservation professionnelle, référencée, à votre nom',
  'Un créneau libre ne se rattrape pas',
  '19 €',
  'Pourquoi êtes-vous moins cher que Planity',
  // Le ton reste ferme sur le modèle, jamais sur le professionnel.
  "Vos clients réservent quand ça les arrange",
  // Le pied de page oriente au lieu de signer.
  'Le manque à gagner',
];
const PHRASES_MARSEILLE = [
  'Vos créneaux vides valent 540 € par mois',
  'On vous les remplit',
  'Publier mes créneaux libres',
  'Vous publiez uniquement vos restes',
  'Une cliente proche réserve',
  'Vous encaissez, à votre prix, en direct',
  'Zéro commission',
  'On ne fixe pas vos prix',
  'On ne touche pas à vos clientes',
  'Aucune exclusivité',
  'Gratuit pendant tout le pilote marseillais',
  'Un seul client par mois rembourse l',
  'validé à la main',
  "jamais une disponibilité qui n'existe pas",
  'Vous cherchez une prestation à domicile',
];
for (const phrase of EST_INDEX ? PHRASES_INDEX : PHRASES_MARSEILLE) ok(texte.includes(phrase), `« ${phrase} »`);

if (EST_INDEX) {
  // Le contre-positionnement attaque le modèle, jamais une enseigne à
  // commission nommée. Seule Planity (abonnement) est citée, en FAQ.
  ok(!/Wecasa|Treatwell|Fresha/i.test(texte), 'aucune place de marché à commission nommée');
  // Le ton vise le statu quo, jamais le professionnel qui lit la page. « Poser
  // un lapin » et « punit » désignent une faute ; ils sont hors sujet ici.
  ok(
    !/\blapins?\b|\bpunit\b|détruit|vous perdez/i.test(texte),
    'aucun terme qui met le professionnel en faute (lapin, punit, détruit)',
  );
} else {
  ok(!/App Beauty|Bordeaux|commission de 12/i.test(texte), "aucune trace de l'ancien positionnement");
}
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texte), 'aucun emoji');
/* Le tiret cadratin est la ponctuation-signature des textes générés. En
   français, la virgule, le deux-points ou la parenthèse font le même travail
   sans donner l'impression d'une page écrite par une machine. */
{
  const brut = await page.locator('body').innerText();
  const restants = (brut.match(/[^\n]{0,34}[—–][^\n]{0,34}/g) || []).slice(0, 4);
  ok(restants.length === 0, `aucun tiret cadratin dans le texte visible ${JSON.stringify(restants)}`);
  const meta = await page.evaluate(() =>
    [document.title, ...[...document.querySelectorAll('meta[content]')].map((m) => m.content)]
      .filter((v) => v && (v.includes('—') || v.includes('–')))
      .slice(0, 3),
  );
  ok(meta.length === 0, `aucun tiret cadratin dans le titre ni les métadonnées ${JSON.stringify(meta)}`);
}
ok(!/\b(Elevez|Boostez|Révolutionnaire|Nouvelle génération)\b/i.test(texte), 'aucun mot creux banni');

/* -------------------------------------------------------------------------- */
/*  4b. Le pied de page                                                       */
/*      Un lien mort dans un pied de page ne se voit pas en relecture : il se */
/*      découvre en démonstration. On vérifie donc que chaque ancre mène       */
/*      quelque part, plutôt que de chercher des phrases — les intitulés       */
/*      passent en capitales par CSS et ne sont pas comparables tels quels.   */
/* -------------------------------------------------------------------------- */
if (EST_INDEX) {
  console.log('\n— Pied de page');
  const pied = await page.evaluate(() => {
    const ancres = [...document.querySelectorAll('footer a[href^="#"]')];
    return {
      liens: ancres.length,
      mortes: ancres.map((a) => a.getAttribute('href')).filter((h) => !document.querySelector(h)),
      metiers: document.querySelectorAll('footer .pied-liens span').length,
      logo: !!document.querySelector('footer .logo-marque[aria-label]'),
      appel: !!document.querySelector('footer .bouton'),
      colonnes: getComputedStyle(document.querySelector('.pied')).gridTemplateColumns.split(' ').length,
    };
  });
  ok(pied.liens >= 6, `le pied oriente vers la page (${pied.liens} liens)`);
  ok(pied.mortes.length === 0, `aucune ancre morte dans le pied ${JSON.stringify(pied.mortes)}`);
  ok(pied.metiers >= 6, `les métiers couverts sont listés (${pied.metiers})`);
  ok(pied.logo, 'le pied porte la marque, annoncée aux lecteurs d’écran');
  ok(pied.appel, 'le pied porte un dernier appel à l’action');
  ok(pied.colonnes === 2, `sur mobile, les listes se partagent la largeur (${pied.colonnes} colonnes)`);

  /* Les listes des offres sont des grilles à deux cases : la coche, le texte.
     Une grille traite chaque enfant comme une case — un <strong> suivi de
     texte en fait donc deux, et la seconde bascule seule à la ligne. Le
     défaut est invisible tant qu'aucune ligne ne mêle gras et texte simple,
     puis il défigure la carte. On impose donc la structure. */
  const listes = await page.evaluate(() =>
    [...document.querySelectorAll('.offre-liste li')]
      .map((li) => ({
        t: (li.textContent || '').trim().slice(0, 30),
        cases: [...li.childNodes].filter(
          (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()),
        ).length,
      }))
      .filter((x) => x.cases !== 2),
  );
  ok(listes.length === 0, `chaque ligne d'offre tient en deux cases : coche et texte ${JSON.stringify(listes.slice(0, 3))}`);

  const paliers = await page.evaluate(() => {
    const carte = (sel) => document.querySelector(sel);
    const compte = (sel) => carte(sel)?.querySelectorAll('.offre-liste li').length ?? 0;
    return {
      classique: compte('.offre:not(.offre-phare)'),
      premium: compte('.offre-phare'),
    };
  });
  ok(
    paliers.premium > paliers.classique,
    `le Premium annonce plus que le Classique (${paliers.premium} contre ${paliers.classique})`,
  );
}

/* -------------------------------------------------------------------------- */
/*  5. Le cœur interactif de la page                                          */
/* -------------------------------------------------------------------------- */
const evenements = [];
await page.exposeFunction('__ev', (n) => evenements.push(n));
await page.evaluate(() => {
  window.gtag = (type, nom) => {
    if (type === 'event') window.__ev(nom);
  };
});

if (EST_INDEX) {
  console.log('\n— Mesure d’audience');
  await page.click('.hero .appel .bouton');
  await page.waitForTimeout(300);
  ok(evenements.includes('cta_hero'), `« cta_hero » part au clic sur l'appel du hero ${JSON.stringify(evenements)}`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

  console.log('\n— Calculateur');
  await page.waitForTimeout(1100); // l'animation d'ouverture dure 900 ms
  ok((await page.locator('#calc-total').innerText()) === '540', 'valeur par défaut : 45 € × 3 × 4 = 540');

  const normalise = (s) => s.replace(/[\s\u00A0\u202F]/g, '');
  await page.evaluate(() => {
    const v = document.getElementById('calc-vides');
    v.value = '5';
    v.dispatchEvent(new Event('input', { bubbles: true }));
    v.dispatchEvent(new Event('change', { bubbles: true }));
  });
  ok(normalise(await page.locator('#calc-total').innerText()) === '900', 'recalcul instantané : 45 € × 5 × 4 = 900');

  await page.evaluate(() => {
    const p = document.getElementById('calc-prix');
    p.value = '100';
    p.dispatchEvent(new Event('input', { bubbles: true }));
    p.dispatchEvent(new Event('change', { bubbles: true }));
  });
  ok(normalise(await page.locator('#calc-total').innerText()) === '2000', 'grands montants formatés : 100 € × 5 × 4 = 2 000');
  ok(
    evenements.filter((n) => n === 'calcul_manque_a_gagner').length === 1,
    `l'événement GA4 « calcul_manque_a_gagner » est émis une seule fois ${JSON.stringify(evenements)}`,
  );
  ok(
    (await page.locator('.calc-resultat').getAttribute('aria-live')) === 'polite',
    'le résultat est annoncé aux lecteurs d’écran (aria-live)',
  );

  console.log('\n— Écrans de téléphone');
  const mockups = await page.evaluate(() => ({
    total: document.querySelectorAll('.telephone').length,
    interactifs: document.querySelectorAll(
      '.telephone a, .telephone button, .telephone input, .telephone select, .telephone h1, .telephone h2, .telephone h3',
    ).length,
    sansRole: [...document.querySelectorAll('.telephone')].filter(
      (t) => t.getAttribute('role') !== 'img' || !t.getAttribute('aria-label'),
    ).length,
  }));
  ok(mockups.total >= 3, `au moins trois appareils dessinés (${mockups.total})`);
  ok(mockups.interactifs === 0, `aucun élément interactif ni titre dans les écrans factices (${mockups.interactifs})`);
  ok(mockups.sansRole === 0, `chaque écran porte role="img" et une description (${mockups.sansRole} sans)`);

  /* La séquence épinglée. On la parcourt à la molette, pas en centrant les
     étapes : la bande de détection n'est pas au même endroit sur mobile et
     sur grand écran, et un centrage artificiel testerait une géométrie que
     personne ne produit en défilant. On vérifie en descendant puis en
     remontant — une bascule qui ne marche que vers le bas est à moitié
     cassée. Et à chaque bascule, le texte actif doit être RÉELLEMENT lisible :
     sous l'appareil épinglé, pas derrière lui. */
  console.log('\n— Séquence épinglée');
  const lire = () =>
    page.evaluate(() => {
      const actif = document.querySelector('.sequence-etape.active');
      const titre = actif?.querySelector('h3').getBoundingClientRect();
      const appareil = document.querySelector('.sequence-scene').getBoundingClientRect();
      return {
        vue: document.querySelector('.telephone.multi .app.active')?.dataset.vue,
        actives: document.querySelectorAll('.telephone.multi .app.active').length,
        etape: actif?.dataset.etape,
        // Sur grand écran l'appareil est à côté du texte : aucun recouvrement
        // possible, le contrôle ne vaut que dans la disposition empilée.
        empile: appareil.left < titre?.left + titre?.width && appareil.bottom < window.innerHeight,
        titreVisible: titre ? titre.top >= appareil.bottom - 4 && titre.bottom <= window.innerHeight : false,
      };
    });

  const parcourir = async (sens) => {
    const vues = [];
    let precedent = null;
    for (let pas = 0; pas < 90; pas += 1) {
      await page.mouse.wheel(0, 130 * sens);
      await page.waitForTimeout(70);
      const etat = await lire();
      if (etat.vue !== precedent) {
        precedent = etat.vue;
        await page.waitForTimeout(600);
        vues.push(await lire());
      }
      if (vues.length >= 3) break;
    }
    return vues;
  };

  await page.evaluate(() => document.querySelector('#reponses').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(300);
  const descente = await parcourir(1);
  ok(
    descente.map((v) => v.vue).join('') === '012',
    `en descendant, les écrans se succèdent dans l'ordre (lu : ${descente.map((v) => v.vue).join('')})`,
  );
  ok(
    descente.every((v) => v.actives === 1 && v.vue === v.etape),
    'un seul écran actif à la fois, toujours celui du texte mis en avant',
  );
  const cachés = descente.filter((v) => v.empile && !v.titreVisible).map((v) => v.etape);
  ok(cachés.length === 0, `à chaque bascule, le titre actif est sous l'appareil et non derrière ${JSON.stringify(cachés)}`);

  const remontee = (await parcourir(-1)).map((v) => Number(v.vue));
  ok(
    remontee.length >= 2 &&
      remontee.at(-1) === 0 &&
      remontee.every((v, i) => i === 0 || v < remontee[i - 1]),
    `en remontant, les écrans redescendent jusqu'au premier (lu : ${remontee.join(' → ')})`,
  );
} else {
  console.log('\n— Bloc de demande (KPI n°3)');
  ok(await page.locator('#boite-demande').isHidden(), 'le mini-formulaire est replié au départ');
  await page.locator('#ouvrir-demande').click();
  ok(await page.locator('#boite-demande').isVisible(), 'il se déplie au clic');
  ok(evenements.includes('interet_cliente'), `l'événement GA4 « interet_cliente » est émis ${JSON.stringify(evenements)}`);
  ok(
    (await page.locator('#ouvrir-demande').getAttribute('aria-expanded')) === 'true',
    'aria-expanded suit l’état',
  );
  ok(await page.locator('#prestation').evaluate((e) => e === document.activeElement), 'le focus part sur le premier champ');
}

/* -------------------------------------------------------------------------- */
/*  6. Les formulaires ne mentent pas quand ENDPOINT est vide                 */
/* -------------------------------------------------------------------------- */
console.log('\n— Honnêteté des formulaires');
const remplir = async () => {
  await page.fill('#prenom', 'Test');
  await page.selectOption('#metier', { index: 1 });
  await page.fill('#zone', EST_INDEX ? 'Lyon 3e' : '13006');
  if (EST_INDEX) {
    await page.check('input[name=se_deplace][value=oui]');
    await page.fill('#email', 'test@exemple.fr');
    await page.selectOption('#canal', { index: 1 });
  } else {
    await page.check('input[name=deplacement][value=oui]');
    await page.fill('#contact', '0600000000');
  }
};

await page.waitForTimeout(1600);
await remplir();
await page.click('#form-pro button[type=submit]');
const alerte = await page.locator('#alerte-pro').innerText();
ok(/inscriptions ne sont pas encore ouvertes/i.test(alerte), 'formulaire non branché : il avertit');
ok(!(await page.locator('#succes-pro').isVisible()), "aucun faux message de succès");
ok(
  !evenements.includes('inscription_pro'),
  `aucune inscription comptée sur un envoi qui n'est pas parti ${JSON.stringify(evenements)}`,
);

if (EST_INDEX) {
  /* Une adresse mal saisie est une demande perdue en silence : le même échec
     que le formulaire non branché, en moins visible. Elle doit être refusée
     AVANT le garde ENDPOINT, et le focus doit revenir sur le champ fautif. */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await remplir();
  await page.fill('#email', 'test@exemple');
  await page.click('#form-pro button[type=submit]');
  const alerteEmail = await page.locator('#alerte-pro').innerText();
  ok(/adresse email ne semble pas valide/i.test(alerteEmail), `email invalide : il le dit (« ${alerteEmail.slice(0, 42)}… »)`);
  ok(await page.locator('#email').evaluate((e) => e === document.activeElement), 'email invalide : le focus revient sur le champ');

  /* Les champs facultatifs le sont vraiment : sans eux, l'envoi doit passer
     la validation et n'échouer que sur le garde ENDPOINT. */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await remplir();
  await page.click('#form-pro button[type=submit]');
  const sansOptionnels = await page.locator('#alerte-pro').innerText();
  ok(
    /inscriptions ne sont pas encore ouvertes/i.test(sansOptionnels),
    'téléphone et réseaux sont bien facultatifs : la validation passe sans eux',
  );
}

/* champ manquant → focus sur le champ fautif */
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1600);
await page.fill('#prenom', 'Test');
await page.click('#form-pro button[type=submit]');
ok(
  await page.locator('#metier').evaluate((e) => e === document.activeElement),
  'champ manquant : le focus va sur le champ fautif',
);

/* -------------------------------------------------------------------------- */
/*  7. Mouvement                                                              */
/* -------------------------------------------------------------------------- */
/* Deux familles, deux seuils. Une COMMANDE qui répond lentement est une
   commande cassée : 300 ms au plus. Une ENTRÉE au défilement est du décor —
   la lui imposer produit une apparition brutale, qui fait cheap. On la laisse
   respirer jusqu'à 1 s, pas au-delà : passé ce point on attend la page. */
console.log('\n— Mouvement');
const mouvement = await page.evaluate(() => {
  const COMMANDES = 'a, button, input, select, summary, label, .bouton';
  const ms = (s) =>
    s.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000)).filter((d) => d > 0);
  let commande = 0;
  let commandeNom = '';
  let decor = 0;
  let decorNom = '';
  for (const e of document.querySelectorAll('*')) {
    const d = Math.max(0, ...ms(getComputedStyle(e).transitionDuration));
    if (!d) continue;
    const nom = `${e.tagName}.${e.getAttribute('class') || ''}`.slice(0, 34);
    if (e.matches(COMMANDES)) {
      if (d > commande) [commande, commandeNom] = [d, nom];
    } else if (d > decor) [decor, decorNom] = [d, nom];
  }
  return { commande, commandeNom, decor, decorNom };
});
ok(mouvement.commande <= 300, `commandes : rien au-delà de 300 ms (max ${mouvement.commande} ms · ${mouvement.commandeNom})`);
ok(mouvement.decor <= 1000, `entrées décoratives : rien au-delà de 1000 ms (max ${mouvement.decor} ms · ${mouvement.decorNom})`);

const ID_COMPTEUR = EST_INDEX ? '#calc-total' : '#compteur';
const ctxReduit = await navigateur.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const pageReduite = await ctxReduit.newPage();
await pageReduite.goto(URL_BASE, { waitUntil: 'load' });
await pageReduite.evaluate(() => document.fonts.ready);
await pageReduite.waitForTimeout(300);
const invisibles = await pageReduite.evaluate(
  () =>
    [...document.querySelectorAll('.reveal, .cascade > *, .sequence-etape')].filter(
      (e) => getComputedStyle(e).opacity !== '1',
    ).length,
);
ok(invisibles === 0, `mouvement réduit : rien n'est masqué (${invisibles} bloc(s) invisible(s))`);
ok(
  (await pageReduite.locator(ID_COMPTEUR).innerText()) === '540',
  'mouvement réduit : le compteur affiche directement 540',
);
await ctxReduit.close();

/* -------------------------------------------------------------------------- */
/*  8. Polices embarquées : aucune requête sortante                           */
/* -------------------------------------------------------------------------- */
/* La mesure d'audience émet forcément une requête vers Google : c'est son
   travail. On ne relâche donc pas le contrôle, on le précise — GA4 est la
   SEULE sortie tolérée, tout le reste reste interdit. Les polices, les images
   et le logo doivent rester dans le fichier. */
console.log('\n— Autonomie');
const ctxReseau = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
const sorties = [];
const versGA4 = [];
await ctxReseau.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith(URL_BASE)) return route.continue();
  if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(u)) {
    versGA4.push(u);
    // On coupe l'appel : le contrôle vérifie qu'il part, pas qu'il aboutisse,
    // et on ne pollue pas les rapports avec des visites de robot.
    return route.abort();
  }
  sorties.push(u);
  return route.continue();
});
const pageReseau = await ctxReseau.newPage();
await pageReseau.goto(URL_BASE, { waitUntil: 'networkidle' });
ok(sorties.length === 0, `aucune requête hors mesure d'audience ${JSON.stringify(sorties.slice(0, 3))}`);
if (EST_INDEX) {
  /* La balise doit être lisible dans le HTML BRUT, sans exécuter le moindre
     script : c'est ainsi que la lisent les outils de contrôle, et un chargeur
     construit en JavaScript passerait pour absent. */
  const html = await readFile(join(RACINE, PAGE_CIBLE), 'utf8');
  const baliseStatique = html.match(
    /<script[^>]+src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)"/,
  );
  ok(!!baliseStatique, 'la balise Google est une balise <script src>, lisible sans exécution');
  const idGA4 = baliseStatique?.[1] ?? '';
  ok(/^G-[A-Z0-9]{8,12}$/.test(idGA4) && !idGA4.startsWith('G-X'), `identifiant GA4 réel dans la page (${idGA4})`);
  ok(
    new RegExp(`gtag\\('config', '${idGA4}'\\)`).test(html),
    `la configuration porte le même identifiant (${idGA4})`,
  );
  ok(versGA4.length > 0, `la balise part vers Google (${versGA4.length} requête(s))`);
  ok(
    versGA4.some((u) => u.includes(idGA4)),
    `la requête porte bien l'identifiant ${idGA4}`,
  );
}
const police = await pageReseau.evaluate(() =>
  getComputedStyle(document.querySelector('h1')).fontFamily.includes('Fraunces'),
);
ok(police, 'Fraunces est bien appliquée au titre');
await ctxReseau.close();

/* -------------------------------------------------------------------------- */
/*  9. Impression paysage                                                     */
/* -------------------------------------------------------------------------- */
console.log('\n— Impression');
await page.emulateMedia({ media: 'print' });
await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
await page.waitForTimeout(400);
const masquesImpression = await page.evaluate(() => {
  const cachés = ['.barre', '.collant', '.grain'].filter((s) => {
    const e = document.querySelector(s);
    return e && getComputedStyle(e).display !== 'none';
  });
  const invisibles = [...document.querySelectorAll('.reveal, .cascade > *, .sequence-etape')].filter(
    (e) => getComputedStyle(e).opacity !== '1',
  ).length;
  const curseursVisibles = [...document.querySelectorAll('.curseur')].filter((e) => getComputedStyle(e).display !== 'none').length;
  const exemple = document.querySelector('.calc-print');
  const exempleVisible = !exemple || getComputedStyle(exemple).display !== 'none';
  // Trois écrans superposés sur un PDF donneraient une bouillie : un seul reste.
  const ecransImprimes = [...document.querySelectorAll('.telephone.multi .app')].filter(
    (e) => getComputedStyle(e).display !== 'none',
  ).length;
  return { cachés, invisibles, curseursVisibles, exempleVisible, ecransImprimes };
});
ok(masquesImpression.cachés.length === 0, `barre, appel collant et grain masqués ${JSON.stringify(masquesImpression.cachés)}`);
ok(masquesImpression.invisibles === 0, `aucun bloc vide sur le PDF (${masquesImpression.invisibles})`);
if (EST_INDEX) {
  ok(masquesImpression.curseursVisibles === 0, 'les curseurs sont masqués à l’impression');
  ok(masquesImpression.exempleVisible, 'la phrase-exemple remplace les curseurs sur le PDF');
  ok(masquesImpression.ecransImprimes === 1, `un seul écran de la séquence sur le PDF (${masquesImpression.ecransImprimes})`);
}
await page.emulateMedia({ media: 'screen' });

/* Le cas le plus dur : impression demandée AVANT la fin de l'animation du
   compteur. Une frame en retard imprimait « 538 € » dans un livrable. */
{
  const c = await navigateur.newContext({ viewport: { width: 1040, height: 711 } });
  const p2 = await c.newPage();
  await p2.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await p2.emulateMedia({ media: 'print' });
  await p2.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await p2.waitForTimeout(500);
  const valeur = await p2.locator(ID_COMPTEUR).innerText();
  ok(valeur === '540', `impression immédiate : le compteur est figé à 540 (lu : ${valeur})`);
  await c.close();
}

/* Navigation au clavier : chaque arrêt doit être visible et atteignable. */
console.log('\n— Clavier');
{
  const c = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await c.newPage();
  await p3.goto(URL_BASE, { waitUntil: 'load' });
  await p3.evaluate(() => document.fonts.ready);
  const arrets = [];
  let sansContour = 0;
  for (let i = 0; i < 22; i += 1) {
    await p3.keyboard.press('Tab');
    const info = await p3.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const contour = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      return { nom: e.id || e.name || (e.textContent || '').trim().slice(0, 22) || e.tagName, contour };
    });
    if (!info) break;
    arrets.push(info.nom);
    if (!info.contour) sansContour += 1;
  }
  ok(arrets.length >= 8, `${arrets.length} arrêts de tabulation atteints`);
  ok(sansContour === 0, `chaque arrêt montre un contour de focus (${sansContour} sans)`);

  if (EST_INDEX) {
    // La FAQ doit s'ouvrir au clavier seul.
    await p3.evaluate(() => document.querySelector('.faq summary').focus());
    await p3.keyboard.press('Enter');
    ok(
      await p3.locator('.faq details').first().evaluate((d) => d.open),
      'la première question de la FAQ s’ouvre à la touche Entrée',
    );
  } else {
    await p3.evaluate(() => document.getElementById('ouvrir-demande').focus());
    await p3.keyboard.press('Enter');
    ok(await p3.locator('#boite-demande').isVisible(), 'le bloc de demande s’ouvre à la touche Entrée');
  }
  await c.close();
}

const pdf = join(RACINE, 'apercu', EST_INDEX ? 'subitis-landing.pdf' : 'marseille.pdf');
await mkdir(join(RACINE, 'apercu'), { recursive: true });
const ctxPdf = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
const pagePdf = await ctxPdf.newPage();
await pagePdf.goto(URL_BASE, { waitUntil: 'load' });
await pagePdf.evaluate(() => document.fonts.ready);
await pagePdf.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
await pagePdf.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true, margin: { top: '11mm', bottom: '11mm', left: '11mm', right: '11mm' } });
const taillePdf = (await readFile(pdf)).length;
ok(taillePdf > 20000, `PDF paysage généré (${Math.round(taillePdf / 1024)} Ko) → apercu/${EST_INDEX ? 'subitis-landing' : 'marseille'}.pdf`);
await ctxPdf.close();

/* -------------------------------------------------------------------------- */
/*  10. Captures                                                              */
/* -------------------------------------------------------------------------- */
console.log('\n— Captures');
await mkdir(join(RACINE, 'apercu'), { recursive: true });
for (const largeur of [390, 768, 1280]) {
  const c = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto(URL_BASE, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => {
    document.querySelectorAll('.reveal, .cascade, .telephone, #semaine').forEach((e) => e.classList.add('vu'));
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(RACINE, 'apercu', `${PREFIXE}-${largeur}.png`), fullPage: true });
  console.log(`  ok   apercu/${PREFIXE}-${largeur}.png`);
  await c.close();
}

ok(erreursConsole.length === 0, `aucune erreur console ${JSON.stringify(erreursConsole.slice(0, 2))}`);

await navigateur.close();
serveur.close();

const html = await readFile(join(RACINE, PAGE_CIBLE));
console.log(`\nPoids de la page : ${Math.round(html.length / 1024)} Ko, fichier unique et autonome.`);
console.log(echecs === 0 ? '\nTOUT VERT\n' : `\n${echecs} ECHEC(S)\n`);
process.exit(echecs === 0 ? 0 : 1);
