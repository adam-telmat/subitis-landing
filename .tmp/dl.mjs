import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const css = await (await fetch(
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap',
  { headers: { 'User-Agent': UA } })).text();
await mkdir('.tmp/fonts', { recursive: true });
// On ne garde que le sous-ensemble latin : le reste (cyrillique, vietnamien) triplerait le poids.
const blocs = css.split('@font-face').slice(1);
const sorties = [];
for (const bloc of blocs) {
  const famille = /font-family: '([^']+)'/.exec(bloc)?.[1];
  const url = /url\((https:[^)]+\.woff2)\)/.exec(bloc)?.[1];
  const unicode = /unicode-range: ([^;]+);/.exec(bloc)?.[1] ?? '';
  // le sous-ensemble latin de base contient U+0000-00FF
  if (!url || !unicode.includes('U+0000-00FF')) continue;
  const bin = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const nom = famille.replace(/\s+/g, '-') + '.woff2';
  await writeFile(`.tmp/fonts/${nom}`, bin);
  sorties.push({ famille, nom, ko: Math.round(bin.length / 1024), b64ko: Math.round((bin.length * 4 / 3) / 1024) });
}
console.table(sorties);
console.log('total base64 estime :', sorties.reduce((s, f) => s + f.b64ko, 0), 'Ko');
