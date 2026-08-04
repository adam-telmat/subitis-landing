/**
 * Embarque les polices dans index.html, une fois pour toutes.
 *
 * POURQUOI CE SCRIPT EXISTE ALORS QUE LE BRIEF INTERDIT UNE ETAPE DE BUILD
 * ----------------------------------------------------------------------
 * Il n'en est pas une. `index.html` est livre COMPLET : on peut l'ouvrir, le
 * modifier et le publier sans jamais executer ce fichier. Le script n'est la
 * que pour REFAIRE l'operation si l'on change de police un jour.
 *
 * Ce qu'il resout, et que le lien Google Fonts ne resout pas :
 *   - la page s'affiche a l'identique sans reseau, donc l'impression PDF et la
 *     demonstration devant un jury ne dependent de rien ;
 *   - plus de decalage de mise en page au chargement des polices (la base de
 *     regles UI/UX classe « Font Loading / layout shift » en severite moyenne) ;
 *   - aucun appel a Google, donc aucun transfert de donnees a declarer.
 *
 *   node outils/embarquer-polices.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RACINE, '.polices');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REQUETE =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap';

/** Recupere les woff2 du sous-ensemble latin uniquement. */
async function recupererPolices() {
  const css = await (await fetch(REQUETE, { headers: { 'User-Agent': UA } })).text();
  const retenues = new Map();

  for (const bloc of css.split('@font-face').slice(1)) {
    const famille = /font-family: '([^']+)'/.exec(bloc)?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(bloc)?.[1];
    const plage = /unicode-range: ([^;]+);/.exec(bloc)?.[1] ?? '';

    // Le latin de base suffit : garder le cyrillique et le vietnamien
    // triplerait le poids du fichier pour une page en francais.
    if (!famille || !url || !plage.includes('U+0000-00FF')) continue;
    if (retenues.has(famille)) continue;

    const octets = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    retenues.set(famille, octets);
    console.log(`  ${famille.padEnd(20)} ${String(Math.round(octets.length / 1024)).padStart(4)} Ko`);
  }
  return retenues;
}

/** Les deux polices sont variables : un seul fichier couvre toutes les graisses. */
function fabriquerCss(polices) {
  const regles = [];
  for (const [famille, octets] of polices) {
    const graisses = famille === 'Fraunces' ? '300 600' : '400 600';
    regles.push(`@font-face{font-family:'${famille}';font-style:normal;font-weight:${graisses};font-display:swap;src:url(data:font/woff2;base64,${octets.toString('base64')}) format('woff2')}`);
  }
  return regles.join('\n');
}

const DEBUT = '/* @POLICES-DEBUT@ */';
const FIN = '/* @POLICES-FIN@ */';

const chemin = join(RACINE, 'index.html');
let html = await readFile(chemin, 'utf8');

if (!html.includes(DEBUT) || !html.includes(FIN)) {
  console.error(`Marqueurs ${DEBUT} / ${FIN} introuvables dans index.html.`);
  process.exit(1);
}

console.log('Recuperation des polices (sous-ensemble latin) :');
const polices = await recupererPolices();
if (polices.size < 2) {
  console.error('Moins de deux familles recuperees. On ne touche pas au fichier.');
  process.exit(1);
}

await mkdir(CACHE, { recursive: true });
for (const [famille, octets] of polices) {
  await writeFile(join(CACHE, `${famille.replace(/\s+/g, '-')}.woff2`), octets);
}

const avant = html.slice(0, html.indexOf(DEBUT) + DEBUT.length);
const apres = html.slice(html.indexOf(FIN));
html = `${avant}\n${fabriquerCss(polices)}\n${apres}`;

await writeFile(chemin, html, 'utf8');
console.log(`\nindex.html : ${Math.round(Buffer.byteLength(html) / 1024)} Ko au total.`);
