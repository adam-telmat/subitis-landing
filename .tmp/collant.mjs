import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/telmat/Desktop/hackaton-app/package.json');
const { chromium } = require('@playwright/test');
const srv = createServer(async (_q, r) => { r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(await readFile('index.html')); });
await new Promise(r => srv.listen(4196, r));
const nav = await chromium.launch();
for (const mouvement of ['no-preference', 'reduce']) {
  const c = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: mouvement });
  const p = await c.newPage();
  await p.goto('http://localhost:4196/', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const H = await p.evaluate(() => document.body.scrollHeight);
  const etats = [];
  for (const [nom, y] of [['haut', 0], ['apres le hero', 1200], ['milieu', Math.round(H*0.5)], ['formulaire', await p.evaluate(() => document.getElementById('candidature').offsetTop)], ['bas', H]]) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await p.waitForTimeout(420);
    const v = await p.evaluate(() => {
      const c = document.getElementById('collant');
      return getComputedStyle(c).transform === 'none' || getComputedStyle(c).transform.includes('matrix(1, 0, 0, 1, 0, 0)');
    });
    etats.push(`${nom}=${v ? 'VISIBLE' : 'cache'}`);
  }
  console.log(`mouvement ${mouvement.padEnd(14)} : ${etats.join(' · ')}`);
  await c.close();
}
await nav.close(); srv.close();
