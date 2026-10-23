// Lighthouse (mobile) for every page, median of 3 runs per page.
// Usage: node scripts/lighthouse.mjs [base-url] [runs]
//   Local (after `npm run emu` + `npm run seed:dev` + a preview of an emulator build on port 4173):
//     node scripts/lighthouse.mjs http://localhost:4173/Buchungssystem
//   Live: node scripts/lighthouse.mjs https://www.praesenzwert.de/Buchungssystem  (pass real codes via env, see below)
// Codes/links default to the demo values of scripts/seed-dev.ts; override with LH_TABLE, LH_WAITER, LH_BAR.
// Uses Playwright's Chromium, so no separate Chrome install is needed.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? 'http://localhost:4173/Buchungssystem').replace(/\/$/, '');
const runs = Number(process.argv[3] ?? 3);
const pages = {
  Gast: `${base}/tisch/#${process.env.LH_TABLE ?? 'DEM2TSCH2Z'}`,
  Kellner: `${base}/kellner/#${process.env.LH_WAITER ?? 'DEMXKEBESXZ2345678ABCDEF'}`,
  Theke: `${base}/theke/#${process.env.LH_BAR ?? 'DEMXTHEKEXZ2345678ABCDEF'}`,
  Verwaltung: `${base}/admin/`,
  Start: `${base}/`,
  Rechtliches: `${base}/rechtliches/`,
};

const out = mkdtempSync(join(tmpdir(), 'lh-'));
const env = { ...process.env, CHROME_PATH: chromium.executablePath() };
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`Lighthouse mobil, Median aus ${runs} Läufen – ${base}\n`);
console.log('Seite         Perf  A11y  BP    FCP     LCP     TBT     CLS');
for (const [name, url] of Object.entries(pages)) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    const file = join(out, `${name}-${i}.json`);
    execFileSync('npx', ['-y', 'lighthouse@13.5.0', url, '--only-categories=performance,accessibility,best-practices',
      '--chrome-flags=--headless=new', '--output=json', `--output-path=${file}`, '--quiet'], { env, stdio: 'ignore', shell: process.platform === 'win32' }); // npx is a .cmd on Windows
    results.push(JSON.parse(readFileSync(file, 'utf8')));
  }
  const score = c => median(results.map(r => Math.round(r.categories[c].score * 100)));
  const metric = id => median(results.map(r => r.audits[id].numericValue));
  const s = v => `${(v / 1000).toFixed(1)} s`.padEnd(8);
  console.log(
    `${name.padEnd(14)}${String(score('performance')).padEnd(6)}${String(score('accessibility')).padEnd(6)}${String(score('best-practices')).padEnd(6)}` +
      `${s(metric('first-contentful-paint'))}${s(metric('largest-contentful-paint'))}${`${Math.round(metric('total-blocking-time'))} ms`.padEnd(8)}${metric('cumulative-layout-shift').toFixed(3)}`,
  );
}
console.log(`\nBerichte (JSON): ${out}`);
