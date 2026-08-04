import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');
const srv = createServer(async (_q, r) => { r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(await readFile('index.html')); });
await new Promise(r => srv.listen(4195, r));
await mkdir('.tmp/print', { recursive: true });
const nav = await chromium.launch();
// A4 paysage a 96 ppp, marges 11 mm : 1123 - 83 = 1040 x 794 - 83 = 711
const c = await nav.newContext({ viewport: { width: 1040, height: 711 } });
const p = await c.newPage();
await p.goto('http://localhost:4195/', { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.emulateMedia({ media: 'print' });
await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
await p.waitForTimeout(400);
const H = await p.evaluate(() => document.body.scrollHeight);
const pages = Math.ceil(H / 711);
console.log(`hauteur en mode impression : ${H} px -> environ ${pages} pages A4 paysage`);
for (let i = 0; i < Math.min(pages, 8); i++) {
  await p.evaluate((y) => window.scrollTo(0, y), i * 711);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `.tmp/print/p${i + 1}.png` });
}
await nav.close(); srv.close();
