import { appendFileSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addProduct, adminLogin, BASE, device, joinAsWaiter, loadAllImages, openBar, problemsOf, seed, TABLE_12 } from './helpers';

// Every screen at 360/390/430/768/1024/1920 px. Fails on horizontal scrolling and on touch targets
// below 44 px on phones; writes full-page screenshots to test-results/screens/ for a visual check.

const WIDTHS = [360, 390, 430, 768, 1024, 1920];
const heightFor = (w: number) => (w < 600 ? 844 : w < 1200 ? 1024 : 1080);
const OUT = 'test-results/screens';

interface Finding {
  screen: string;
  width: number;
  kind: 'overflow' | 'small-target';
  detail: string;
}
let findings: Finding[] = [];

test.beforeEach(() => {
  findings = [];
});

/** Each test fails on its own findings; all of them are also appended to findings.txt. */
test.afterEach(() => {
  mkdirSync(OUT, { recursive: true });
  for (const f of findings) appendFileSync(`${OUT}/findings.txt`, `${f.kind}	${f.screen}	${f.width}	${f.detail}
`);
  expect(findings.filter(f => f.kind === 'overflow'), 'horizontal scrolling').toEqual([]);
  expect(findings.filter(f => f.kind === 'small-target'), 'touch targets below 44 px on phones').toEqual([]);
});

/** Elements sticking out to the right, and tappable things smaller than 44 × 44 px (phones only). */
async function audit(page: Page, screen: string, width: number) {
  const r = await page.evaluate(phone => {
    const vw = document.documentElement.clientWidth;
    const desc = (el: Element) => {
      const name = el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${name ? ` "${name}"` : ''}`;
    };
    const overflow = document.documentElement.scrollWidth > vw
      ? [...document.querySelectorAll('body *')]
          .filter(el => {
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.right <= vw + 1) return false;
            // Ignore content inside horizontal scrollers (category chips, tabs) – they scroll on purpose.
            for (let p = el.parentElement; p; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false;
            }
            return true;
          })
          .slice(0, 5)
          .map(el => `${desc(el)} right=${Math.round(el.getBoundingClientRect().right)} > ${vw}`)
      : [];
    const small = phone
      ? [...document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"], [role="switch"]')]
          .filter(el => {
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) return false;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || el.closest('[aria-hidden="true"], [inert]')) return false;
            // Links inside running text are exempt (WCAG 2.5.8 inline exception).
            if (el.tagName === 'A' && el.parentElement?.closest('p, li') && style.display === 'inline') return false;
            // Layout size, not the on-screen box: pop-in animations scale controls for a moment.
            const h = el as HTMLElement;
            return h.offsetWidth < 44 || h.offsetHeight < 44;
          })
          .map(el => `${desc(el)} ${(el as HTMLElement).offsetWidth}×${(el as HTMLElement).offsetHeight}`)
      : [];
    return { overflow, small: [...new Set(small)] };
  }, width <= 430);
  for (const d of r.overflow) findings.push({ screen, width, kind: 'overflow', detail: d });
  for (const d of r.small) findings.push({ screen, width, kind: 'small-target', detail: d });
}

async function capture(page: Page, screen: string, prepare?: () => Promise<void>) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: heightFor(w) });
    await prepare?.();
    await page.waitForTimeout(350);
    await loadAllImages(page);
    await audit(page, screen, w);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${screen}-${w}.png`, fullPage: true, animations: 'disabled' });
  }
}

// Many full-page screenshots per test.
test.describe.configure({ timeout: 300_000 });

for (const lang of ['koelsch', 'hochdeutsch'] as const) {
  test(`guest pages (${lang})`, async ({ browser }) => {
    seed(...(lang === 'hochdeutsch' ? ['--hochdeutsch', '--broadcast'] : []));
    const page = await device(browser);
    await page.goto(`${BASE}/tisch/#${TABLE_12}`);
    await expect(page.getByRole('heading', { name: 'Tisch 12' })).toBeVisible();
    await capture(page, `${lang}/tisch`);

    await addProduct(page, 'Kölsch', 2);
    await addProduct(page, 'Cola');
    await capture(page, `${lang}/tisch-warenkorb`, async () => {
      if (!(await page.getByRole('dialog').isVisible())) await page.getByRole('button', { name: /Ansehen$/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    await page.goto(`${BASE}/`);
    await capture(page, `${lang}/start`);
    await page.goto(`${BASE}/rechtliches/`);
    await capture(page, `${lang}/rechtliches`);
    expect(problemsOf(page)).toEqual([]);
  });
}

test('guest notices: paused and shut down', async ({ browser }) => {
  seed('--paused');
  const page = await device(browser);
  await page.goto(`${BASE}/tisch/#${TABLE_12}`);
  await expect(page.getByText('Bestellungen pausiert')).toBeVisible();
  await capture(page, 'koelsch/tisch-pausiert');
  seed('--shutdown');
  await expect(page.getByText('System außer Betrieb')).toBeVisible();
  await capture(page, 'koelsch/tisch-aus');
  await page.goto(`${BASE}/tisch/#ZZZZZZZZZZ`);
  await expect(page.getByText('Code ungültig')).toBeVisible();
  await capture(page, 'koelsch/tisch-ungueltig');
});

test('waiter screens', async ({ browser }) => {
  seed();
  const page = await device(browser);
  await page.goto(`${BASE}/kellner/#DEMXKEBESXZ2345678ABCDEF`);
  await expect(page.getByLabel('Dein Name')).toBeVisible();
  await capture(page, 'personal/kellner-name');
  await joinAsWaiter(page, 'Anna', ['12', '7', '56a']);
  await capture(page, 'personal/kellner-liste');
  await page.getByRole('button', { name: 'Bon', exact: true }).click();
  await capture(page, 'personal/kellner-bon');
  await page.getByRole('button', { name: 'Liste' }).click();
  await page.getByRole('button', { name: /^Anna/ }).click();
  await capture(page, 'personal/kellner-profil');
  expect(problemsOf(page)).toEqual([]);
});

test('bar screens', async ({ browser }) => {
  seed('--two-bars');
  const page = await device(browser);
  await openBar(page);
  await capture(page, 'personal/theke');
  await page.getByRole('button', { name: 'Ausverkauft' }).click();
  await capture(page, 'personal/theke-ausverkauft');
  expect(problemsOf(page)).toEqual([]);
});

test('admin screens', async ({ browser }) => {
  seed();
  const page = await device(browser);
  await page.goto(`${BASE}/admin/`);
  await expect(page.getByRole('heading', { name: 'Verwaltung' })).toBeVisible();
  await capture(page, 'admin/login');
  await adminLogin(page);
  for (const [tab, file] of [
    ['Übersicht', 'uebersicht'], ['Veranstaltungen', 'veranstaltungen'], ['Karte', 'karte'], ['Tische & QR', 'tische'],
    ['Personal', 'personal'], ['Nachrichten', 'nachrichten'], ['Statistik', 'statistik'], ['Einstellungen', 'einstellungen'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await capture(page, `admin/${file}`);
  }
  expect(problemsOf(page)).toEqual([]);
});

