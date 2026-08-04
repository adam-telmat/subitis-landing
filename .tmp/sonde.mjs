import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');
const srv = createServer(async (_q, r) => { r.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); r.end(await readFile('index.html')); });
await new Promise(r => srv.listen(4199, r));
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 320, height: 900 } })).newPage();
await p.goto('http://localhost:4199/', { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
const c = await p.evaluate(() => {
  const lim = document.documentElement.clientWidth;
  return [...document.querySelectorAll('*')]
    .map(e => { const r = e.getBoundingClientRect();
      return { t: e.tagName, cl: String(e.className).slice(0,26), id: e.id, l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; })
    .filter(x => x.r > lim + 1)
    .slice(0, 8);
});
console.table(c);
await nav.close(); srv.close();
