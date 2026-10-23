import { expect, test, type Page } from '@playwright/test';
import { addProduct, BASE, dbGet, device, joinAsWaiter, openBar, problemsOf, seed, TABLE_12, tablet } from './helpers';

// Three devices side by side, like on the evening: guest phone, waiter phone, bar tablet.

interface Stats {
  totalOrders: number;
  totalCents: number;
  byWaiter?: Record<string, { name: string; orders: number; cents: number }>;
  byProduct?: Record<string, { qty: number; cents: number }>;
}

const stats = () => dbGet<Stats | null>('events/demo/stats');
const guestCard = (page: Page, summary: string) => page.getByRole('listitem').filter({ hasText: summary });

test.describe('guest → waiter → bar → served', () => {
  test.beforeEach(() => seed('--empty'));

  test('one order runs through all three screens and is counted to the cent', async ({ browser }) => {
    const waiter = await device(browser);
    const bar = await device(browser, tablet);
    const guest = await device(browser);

    await joinAsWaiter(waiter, 'Anna', ['12']);
    await openBar(bar);
    await expect(bar.getByText('Alles raus')).toBeVisible();

    // Guest orders 2× Kölsch + 1× Cola = 8,50 €
    await guest.goto(`${BASE}/tisch/#${TABLE_12}`);
    await expect(guest.getByRole('heading', { name: 'Tisch 12' })).toBeVisible();
    await addProduct(guest, 'Kölsch', 2);
    await addProduct(guest, 'Cola');
    await guest.getByRole('button', { name: /8,50\s€ Ansehen$/ }).click();
    await expect(guest.getByRole('dialog', { name: 'Deine Bestellung' })).toBeVisible();
    await guest.getByRole('button', { name: 'Jetzt bestellen' }).click();
    await expect(guest.getByText('Bestellung ist raus!')).toBeVisible();
    const card = guestCard(guest, '2× Kölsch, 1× Cola');
    await expect(card.locator('[aria-current="step"]')).toHaveText('Gesendet');

    // Waiter: full-screen alarm for table 12 → take it
    const alarm = waiter.getByRole('alertdialog');
    await expect(alarm).toContainText('Neue Bestellung');
    await expect(alarm).toContainText('12');
    await alarm.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(alarm).toBeHidden();
    await expect(card.locator('[aria-current="step"]')).toHaveText('Anna bringt’s');

    // Bar: ticket with the waiter's name → ready (and once undone, to prove undo is exact)
    const tile = bar.getByRole('listitem').filter({ hasText: 'Anna' });
    await expect(tile).toContainText('Kölsch');
    await tile.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(async () => (await stats())?.totalCents).toBe(850);
    await bar.getByRole('button', { name: 'Rückgängig' }).click();
    await expect.poll(async () => (await stats())?.totalCents ?? 0).toBe(0);
    await expect(tile.getByRole('button', { name: 'Fertig' })).toBeVisible();
    await tile.getByRole('button', { name: 'Fertig' }).click();
    await expect(bar.getByRole('region', { name: /Abholbereit/ })).toContainText('Anna');

    // Waiter: "Fertig – abholen" → served
    const ticket = waiter.getByRole('listitem').filter({ hasText: 'Fertig – abholen' });
    await expect(ticket).toBeVisible();
    await ticket.getByRole('button', { name: 'Serviert' }).click();
    await expect(waiter.getByText('Alles ruhig')).toBeVisible();
    await expect(card).toContainText('Serviert. Prost!');
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(bar.getByText('Alles raus')).toBeVisible();

    const s = await stats();
    expect(s).toMatchObject({ totalOrders: 1, totalCents: 850 });
    expect(s?.byProduct?.koelsch).toMatchObject({ qty: 2, cents: 600 });
    expect(Object.values(s?.byWaiter ?? {})).toEqual([expect.objectContaining({ name: 'Anna', orders: 1, cents: 850 })]);

    for (const p of [guest, waiter, bar]) expect(problemsOf(p)).toEqual([]);
  });

  test('a waiter call reaches the waiter and the guest sees who comes', async ({ browser }) => {
    const waiter = await device(browser);
    const guest = await device(browser);
    await joinAsWaiter(waiter, 'Jupp', ['12']);

    await guest.goto(`${BASE}/tisch/#${TABLE_12}`);
    await guest.getByRole('button', { name: 'Köbes kumm ran' }).click();
    // Second tap confirms (no accidental calls)
    await guest.getByRole('button', { name: 'Wirklich rufen?' }).click();
    await expect(guest.getByText('Der Köbes kütt!')).toBeVisible();

    const alarm = waiter.getByRole('alertdialog');
    await expect(alarm).toContainText('Tisch ruft dich');
    await alarm.getByRole('button', { name: 'Ich gehe hin' }).click();
    await expect(guestCard(guest, 'Köbes kumm ran').locator('[aria-current="step"]')).toHaveText('Jupp kütt');
    expect(problemsOf(guest)).toEqual([]);
  });
});

test.describe('Schnellbon privacy', () => {
  test.beforeEach(() => seed('--empty'));

  test('a private bon is only visible to its waiter; a bar bon reaches the bar but no colleague', async ({ browser }) => {
    const anna = await device(browser);
    const ben = await device(browser);
    const bar = await device(browser, tablet);
    await joinAsWaiter(anna, 'Anna', ['12']);
    await joinAsWaiter(ben, 'Ben', ['12']);
    await openBar(bar);

    const newBon = async (note: string, toBar: boolean) => {
      await anna.getByRole('button', { name: 'Bon', exact: true }).click();
      await addProduct(anna, 'Kölsch', 2);
      await anna.getByRole('button', { name: /6,00\s€ Ansehen$/ }).click();
      await anna.getByPlaceholder('z. B. Fenster, rote Jacke').fill(note);
      const sw = anna.getByRole('switch', { name: /An die Theke senden/ });
      if ((await sw.getAttribute('aria-checked')) !== String(toBar)) await sw.click();
      await anna.getByRole('button', { name: 'Bon speichern' }).click();
      await expect(anna.getByRole('heading', { name: /Meine Aufträge/ })).toBeVisible();
      await expect(anna.getByRole('listitem').filter({ hasText: note })).toBeVisible();
    };

    await newBon('Fenster', false);
    await expect(anna.getByRole('listitem').filter({ hasText: 'Fenster' })).toContainText('Nur bei dir');

    await newBon('rote Jacke', true);
    await expect(bar.getByRole('listitem').filter({ hasText: 'rote Jacke' })).toBeVisible();

    // Give the realtime feeds time to deliver anything they (wrongly) would deliver.
    await ben.waitForTimeout(2500);
    await expect(bar.getByText('Fenster')).toHaveCount(0);
    for (const note of ['Fenster', 'rote Jacke']) await expect(ben.getByText(note)).toHaveCount(0);
    await expect(ben.getByRole('alertdialog')).toHaveCount(0);
    await expect(ben.getByText('Alles ruhig')).toBeVisible();

    // Both bons count once they are paid
    for (const note of ['Fenster', 'rote Jacke']) {
      await anna.getByRole('listitem').filter({ hasText: note }).getByRole('button', { name: 'Kassiert' }).click();
      await expect(anna.getByRole('listitem').filter({ hasText: note })).toHaveCount(0);
    }
    await expect.poll(async () => (await stats())?.totalCents).toBe(1200);
    for (const p of [anna, ben, bar]) expect(problemsOf(p)).toEqual([]);
  });
});
