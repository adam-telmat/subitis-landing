/**
 * Vérification automatisée de la landing, dans un vrai Chromium.
 *
 *   node outils/verifier.mjs
 *
 * Chaque contrôle correspond à une règle de la base UI/UX Pro Max ou à une
 * exigence explicite de `hackathon/J2/BRIEF-LANDING-PAGE.md`. Un contrôle qui
 * échoue nomme la règle : on doit pouvoir décider quoi corriger sans relire
 * tout le fichier.
 *
 * Playwright n'est pas installé ici — on emprunte celui du dépôt de
 * l'application, qui est sur la même machine.
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');

const PORT = 4173;
let echecs = 0;
const ok = (condition, message) => {
  console.log(`${condition ? '  ok  ' : ' ECHEC'} ${message}`);
  if (!condition) echecs += 1;
};

const serveur = createServer(async (_req, res) => {
  const html = await readFile(join(RACINE, 'index.html'));
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
console.log('\n— Mise en page');
for (const largeur of [320, 360, 390, 412, 768, 1024, 1280, 1440]) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL_BASE, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const d = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
    coupables: [...document.querySelectorAll('*')]
      .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 3)
      .map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`),
  }));
  ok(d.s <= d.c + 1, `${largeur} px : pas de défilement horizontal (${d.s} ≤ ${d.c}) ${d.coupables.join(' · ')}`);
  await ctx.close();
}

/* -------------------------------------------------------------------------- */
/*  Le reste des contrôles se joue sur un mobile réel (Pixel 7 ≈ 412 px)      */
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
/*  2. Cibles tactiles ≥ 44 px, espacement ≥ 8 px — sévérité HAUTE            */
/* -------------------------------------------------------------------------- */
console.log('\n— Cibles tactiles');
const petites = await page.evaluate(() =>
  [...document.querySelectorAll('a, button, input:not(.pot), select, .duo label')]
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
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
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
    return `rgb(${r}, ${g}, ${b})`;
  };
  const out = [];
  for (const el of document.querySelectorAll('p, h1, h2, h3, a, span, strong, b, em, li, dt, dd, td, th, label, button, small')) {
    const t = el.textContent?.trim();
    if (!t || t.length < 2 || el.children.length > 0) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const px = parseFloat(s.fontSize);
    const gras = Number(s.fontWeight) >= 700;
    const seuil = px >= 24 || (px >= 18.66 && gras) ? 3 : 4.5;
    const [a, b] = [lum(s.color), lum(fond(el))];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    out.push({ t: t.slice(0, 30), ratio: Math.round(ratio * 100) / 100, seuil, px: Math.round(px) });
  }
  return out.sort((x, y) => x.ratio - y.ratio);
});
const sousSeuil = contrastes.filter((c) => c.ratio < c.seuil);
ok(sousSeuil.length === 0, `contraste AA sur ${contrastes.length} couples · pire : ${contrastes[0]?.ratio}:1`);
if (sousSeuil.length) console.log('        ', JSON.stringify(sousSeuil.slice(0, 6)));

/* -------------------------------------------------------------------------- */
/*  4. Contenu imposé par le brief, mot pour mot                              */
/* -------------------------------------------------------------------------- */
console.log('\n— Contenu du brief');
const texte = (await page.locator('body').innerText()).replace(/\u00A0/g, ' ').replace(/[’']/g, "'");
for (const phrase of [
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
]) ok(texte.includes(phrase), `« ${phrase} »`);

ok(!/App Beauty|Bordeaux|commission de 12/i.test(texte), "aucune trace de l'ancien positionnement");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texte), 'aucun emoji');
ok(!/\b(Elevez|Boostez|Révolutionnaire|Nouvelle génération)\b/i.test(texte), 'aucun mot creux banni');

/* -------------------------------------------------------------------------- */
/*  5. Le KPI n°3 : le bloc de demande                                        */
/* -------------------------------------------------------------------------- */
console.log('\n— Bloc de demande (KPI n°3)');
const evenements = [];
await page.exposeFunction('__ev', (n) => evenements.push(n));
await page.evaluate(() => {
  window.gtag = (type, nom) => {
    if (type === 'event') window.__ev(nom);
  };
});
ok(await page.locator('#boite-demande').isHidden(), 'le mini-formulaire est replié au départ');
await page.locator('#ouvrir-demande').click();
ok(await page.locator('#boite-demande').isVisible(), 'il se déplie au clic');
ok(evenements.includes('interet_cliente'), `l'événement GA4 « interet_cliente » est émis ${JSON.stringify(evenements)}`);
ok(
  (await page.locator('#ouvrir-demande').getAttribute('aria-expanded')) === 'true',
  'aria-expanded suit l’état',
);
ok(await page.locator('#prestation').evaluate((e) => e === document.activeElement), 'le focus part sur le premier champ');

/* -------------------------------------------------------------------------- */
/*  6. Les formulaires ne mentent pas quand ENDPOINT est vide                 */
/* -------------------------------------------------------------------------- */
console.log('\n— Honnêteté des formulaires');
await page.waitForTimeout(1600);
await page.fill('#prenom', 'Test');
await page.selectOption('#metier', { index: 1 });
await page.check('input[name=deplacement][value=oui]');
await page.fill('#zone', '13006');
await page.fill('#contact', '0600000000');
await page.click('#form-pro button[type=submit]');
const alerte = await page.locator('#alerte-pro').innerText();
ok(/pas encore reli/i.test(alerte), 'formulaire non branché : il avertit');
ok(!(await page.locator('#succes-pro').isVisible()), "aucun faux message de succès");

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
console.log('\n— Mouvement');
const durees = await page.evaluate(() =>
  [...document.querySelectorAll('*')]
    .flatMap((e) => getComputedStyle(e).transitionDuration.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000)))
    .filter((d) => d > 0),
);
const maxDuree = Math.max(0, ...durees);
ok(maxDuree <= 300, `aucune transition au-delà de 300 ms (max ${maxDuree} ms)`);

const ctxReduit = await navigateur.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const pageReduite = await ctxReduit.newPage();
await pageReduite.goto(URL_BASE, { waitUntil: 'load' });
await pageReduite.evaluate(() => document.fonts.ready);
await pageReduite.waitForTimeout(300);
const invisibles = await pageReduite.evaluate(
  () => [...document.querySelectorAll('.reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length,
);
ok(invisibles === 0, `mouvement réduit : rien n'est masqué (${invisibles} bloc(s) invisible(s))`);
ok(
  (await pageReduite.locator('#compteur').innerText()) === '540',
  'mouvement réduit : le compteur affiche directement 540',
);
await ctxReduit.close();

/* -------------------------------------------------------------------------- */
/*  8. Polices embarquées : aucune requête sortante                           */
/* -------------------------------------------------------------------------- */
console.log('\n— Autonomie');
const ctxReseau = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
const sorties = [];
await ctxReseau.route('**/*', (route) => {
  const u = route.request().url();
  if (!u.startsWith(URL_BASE)) sorties.push(u);
  return route.continue();
});
const pageReseau = await ctxReseau.newPage();
await pageReseau.goto(URL_BASE, { waitUntil: 'networkidle' });
ok(sorties.length === 0, `aucune requête vers l'extérieur ${JSON.stringify(sorties.slice(0, 3))}`);
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
  const invisibles = [...document.querySelectorAll('.reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length;
  return { cachés, invisibles };
});
ok(masquesImpression.cachés.length === 0, `barre, appel collant et grain masqués ${JSON.stringify(masquesImpression.cachés)}`);
ok(masquesImpression.invisibles === 0, `aucun bloc vide sur le PDF (${masquesImpression.invisibles})`);
await page.emulateMedia({ media: 'screen' });

const pdf = join(RACINE, 'apercu', 'subitis-landing.pdf');
await mkdir(join(RACINE, 'apercu'), { recursive: true });
const ctxPdf = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
const pagePdf = await ctxPdf.newPage();
await pagePdf.goto(URL_BASE, { waitUntil: 'load' });
await pagePdf.evaluate(() => document.fonts.ready);
await pagePdf.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
await pagePdf.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true, margin: { top: '11mm', bottom: '11mm', left: '11mm', right: '11mm' } });
const taillePdf = (await readFile(pdf)).length;
ok(taillePdf > 20000, `PDF paysage généré (${Math.round(taillePdf / 1024)} Ko) → apercu/subitis-landing.pdf`);
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
    document.querySelectorAll('.reveal, #semaine').forEach((e) => e.classList.add('vu'));
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(RACINE, 'apercu', `landing-${largeur}.png`), fullPage: true });
  console.log(`  ok   apercu/landing-${largeur}.png`);
  await c.close();
}

ok(erreursConsole.length === 0, `aucune erreur console ${JSON.stringify(erreursConsole.slice(0, 2))}`);

await navigateur.close();
serveur.close();

const html = await readFile(join(RACINE, 'index.html'));
console.log(`\nPoids de la page : ${Math.round(html.length / 1024)} Ko, fichier unique et autonome.`);
console.log(echecs === 0 ? '\nTOUT VERT\n' : `\n${echecs} ECHEC(S)\n`);
process.exit(echecs === 0 ? 0 : 1);
