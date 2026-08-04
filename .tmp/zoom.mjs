import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');
const srv = createServer(async (_q, r) => { r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(await readFile('index.html')); });
await new Promise(r => srv.listen(4198, r));
await mkdir('.tmp/zoom', { recursive: true });
const nav = await chromium.launch();
for (const [nom, largeur, sel] of [
  ['semaine-desktop', 1280, '#semaine'],
  ['comparatif', 1280, '.comparatif'],
  ['hero-mobile', 390, '.hero'],
  ['semaine-mobile', 390, '#semaine'],
  ['comparatif-mobile', 390, '.comparatif'],
  ['formulaire-mobile', 390, '#candidature'],
]) {
  const c = await nav.newContext({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto('http://localhost:4198/', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.querySelectorAll('.reveal, #semaine').forEach(e => e.classList.add('vu')));
  await p.waitForTimeout(250);
  await p.locator(sel).screenshot({ path: `.tmp/zoom/${nom}.png` });
  console.log('  ', nom);
  await c.close();
}
await nav.close(); srv.close();
