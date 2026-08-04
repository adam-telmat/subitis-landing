import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');
const srv = createServer(async (_q, r) => { r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(await readFile('index.html')); });
await new Promise(r => srv.listen(4197, r));
await mkdir('.tmp/fen', { recursive: true });
const nav = await chromium.launch();
const c = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const p = await c.newPage();
await p.goto('http://localhost:4197/', { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
const H = await p.evaluate(() => document.body.scrollHeight);
console.log('hauteur totale mobile :', H, 'px =', Math.round(H/844), 'ecrans');
for (let i = 0; i < 6; i++) {
  const y = Math.round(i * (H - 844) / 5);
  await p.evaluate((y) => window.scrollTo(0, y), y);
  await p.waitForTimeout(450);
  await p.screenshot({ path: `.tmp/fen/m${i}.png` });
}
// verification du chevauchement reel de la barre collante
const chevauche = await p.evaluate(() => {
  const c = document.getElementById('collant');
  const r = c.getBoundingClientRect();
  const dessous = document.elementFromPoint(window.innerWidth / 2, r.top - 6);
  return { visible: c.classList.contains('visible'), haut: Math.round(r.top), dessous: dessous?.tagName };
});
console.log('barre collante :', JSON.stringify(chevauche));
await nav.close(); srv.close();
