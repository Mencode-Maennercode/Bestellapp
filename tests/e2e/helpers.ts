import { execFileSync } from 'node:child_process';
import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

// Fixed demo values from scripts/seed-dev.ts.
export const WAITER_TOKEN = 'DEMXKEBESXZ2345678ABCDEF';
export const BAR_TOKEN = 'DEMXTHEKEXZ2345678ABCDEF';
export const ADMIN_PIN = '123456';
export const TABLE_12 = 'DEM2TSCH2Z';
export const BASE = '/Buchungssystem';

const DB = 'http://127.0.0.1:9000';
const NS = 'demo-karneval';

/** Resets the emulator database to the demo event (options as in scripts/seed-dev.ts). */
export function seed(...args: string[]) {
  execFileSync(process.execPath, ['scripts/seed-dev.ts', ...args], { stdio: 'pipe' });
}

/** Reads a path with owner rights, bypassing the rules (for checks only). */
export async function dbGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return JSON.parse(text) as T;
}

export const phone: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
export const tablet: BrowserContextOptions = { viewport: { width: 1024, height: 768 }, hasTouch: true };

/** A separate device: own browser context = own anonymous login, own local storage. */
export async function device(browser: Browser, opts: BrowserContextOptions = phone): Promise<Page> {
  const ctx = await browser.newContext({ ...opts, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  watchErrors(page);
  return page;
}

/** Collects uncaught errors and failed requests; `expectClean` fails the test if there were any. */
export function watchErrors(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('response', r => {
    if (r.status() >= 400 && new URL(r.url()).port === new URL(page.url() || 'http://localhost:4174').port) problems.push(`${r.status()} ${r.url()}`);
  });
  (page as Page & { problems?: string[] }).problems = problems;
  return problems;
}

export function problemsOf(page: Page): string[] {
  return (page as Page & { problems?: string[] }).problems ?? [];
}

/** Opens the waiter link and walks through name → tables → alarm. */
export async function joinAsWaiter(page: Page, name: string, tables: string[]) {
  await page.goto(`${BASE}/kellner/#${WAITER_TOKEN}`);
  await page.getByLabel('Dein Name').fill(name);
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const t of tables) await page.getByRole('button', { name: new RegExp(`^Tisch ${t}(,|$)`) }).click();
  await page.getByRole('button', { name: /^(Weiter|Ohne feste Tische weiter)$/ }).click();
  await page.getByRole('button', { name: 'Ohne Ton weiter' }).click();
  await expect(page.getByRole('heading', { name: /Meine Aufträge/ })).toBeVisible();
}

export async function openBar(page: Page) {
  await page.goto(`${BASE}/theke/#${BAR_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Theke', level: 1 })).toBeVisible();
}

export async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin/`);
  for (const d of ADMIN_PIN) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('heading', { name: 'Verwaltung', level: 1 })).toBeVisible();
}

/** Adds a product from the menu by tapping its card (first card of that name). */
export async function addProduct(page: Page, name: string, times = 1) {
  const card = page.getByRole('button', { name: new RegExp(`^${name} hinzufügen`) }).first();
  for (let i = 0; i < times; i++) await card.click();
}

/** Loads lazy images so full-page screenshots show every photo. */
export async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img')];
    imgs.forEach(i => (i.loading = 'eager'));
    await Promise.all(imgs.map(i => (i.complete ? null : new Promise(r => ((i.onload = r), (i.onerror = r))))));
  });
}
