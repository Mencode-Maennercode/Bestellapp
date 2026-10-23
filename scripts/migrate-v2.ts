// One-time move of the old (v1) database into the v2 model.
//
//   1. Backup first (read-only, the old database is open for reading):
//        node scripts/migrate-v2.ts --fetch https://<altes-projekt>-default-rtdb.<region>.firebasedatabase.app
//      → backups/legacy-<datum>.json   (contains guest e-mail addresses: stays out of git)
//
//   2. Dry run (default): shows what would happen, writes nothing but the plan file.
//        node scripts/migrate-v2.ts --in backups/legacy-<datum>.json --out backups/plan.json
//        Options: --name "Karneval 2026"  --start 2026-02-12  --end 2026-02-18  --id karneval-2026  --history
//
//   3. Apply:
//        node scripts/migrate-v2.ts --in <backup> --apply --target emulator
//        node scripts/migrate-v2.ts --in <backup> --apply --target <neue-database-url>   (needs GOOGLE_APPLICATION_CREDENTIALS)
//
// What happens to the old data:
//   • Products, prices, categories, tables, bars  → become the catalog of ONE closed event "Karneval 2026"
//     (the natural template: "Veranstaltung duplizieren" copies it, with brand-new table codes and links).
//   • Statistics (exact to the cent, productId keys)       → stats of that event.
//   • Ratings                                              → feedback (name, e-mail, text only).
//   • Table codes, waiter assignments, FCM tokens, open orders, admin PIN / master password
//     → deliberately NOT migrated. The archive event has no guest codes and no staff links: nothing of
//       the old system can order or read anything in a new event.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultCatalog } from '../shared/catalog-seed.ts';
import { slugify } from '../shared/slug.ts';
import { UNKNOWN_WAITER } from '../shared/stats.ts';
import type { Bar, Catalog, EventIndexEntry, EventPublic, Product, Stats, Table } from '../shared/types.ts';

export { slugify };

type Json = Record<string, any>; // legacy data is untyped on purpose

export interface Options {
  /** Event id of the archive event. */
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  /** Also turn the old "statisticsHistory" resets into their own archive events. */
  history: boolean;
  now: number;
}

export interface Plan {
  /** Flat database paths → values (a multi-path update). */
  writes: Record<string, unknown>;
  /** Human-readable summary lines; "!" marks something to look at. */
  report: string[];
}

const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter(x => x != null) as T[]) : v && typeof v === 'object' ? (Object.values(v) as T[]) : []);
const entries = (v: unknown): [string, any][] =>
  Array.isArray(v) ? v.map((x, i) => [String(i), x] as [string, any]).filter(([, x]) => x != null) : v && typeof v === 'object' ? Object.entries(v) : [];

const normName = (n: string) => n.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9äöüß]/g, '');
const cents = (euro: unknown): number => {
  const n = Number(euro);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const clip = (v: unknown, max: number): string => String(v ?? '').slice(0, max);
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Catalog: built-in 2026 menu → overridden by the old "config/menu" → plus custom drinks / categories. */
function buildCatalog(legacy: Json, report: string[]): Catalog {
  const catalog = defaultCatalog();
  const { categories, products } = catalog;

  // Custom / renamed categories.
  const oldCats = legacy.database?.categories ?? {};
  let order = 100;
  for (const [cid, c] of entries(oldCats.categories)) {
    if (c?.isActive === false || c?.deletedAt) {
      if (categories[cid]) categories[cid].active = false;
      continue;
    }
    categories[slugify(cid)] ??= { name: clip(c?.name ?? cid, 30), sort: order++, active: true };
  }
  asList<string>(oldCats.order).forEach((cid, i) => {
    if (categories[cid]) categories[cid].sort = i + 1;
  });

  // Overrides from the admin screen of the old app.
  let overridden = 0;
  for (const [id, o] of entries(legacy.config?.menu?.items)) {
    const p = products[id];
    if (!p) continue;
    overridden++;
    if (o.name) p.name = clip(o.name, 40);
    if (o.price != null) p.priceCents = cents(o.price);
    if (o.description != null) p.description = clip(o.description, 80);
    if (o.size != null) p.size = clip(o.size, 20);
    if (typeof o.isPopular === 'boolean') p.popular = o.isPopular;
    if (typeof o.category === 'string' && categories[o.category]) p.categoryId = o.category;
    if (o.askForGlasses === false) delete p.glassPrompt;
    else if (o.askForGlasses && ['beer', 'wine', 'sekt'].includes(o.glassType)) p.glassPrompt = o.glassType;
    if (o.tableSection === null) delete p.tableSection;
    else if (o.tableSection) p.tableSection = o.tableSection;
  }

  // Drinks the club added itself.
  let custom = 0;
  for (const [did, d] of entries(legacy.database?.drinks?.drinks)) {
    if (products[did] || !d?.name) continue;
    const id = slugify(did);
    if (products[id]) continue;
    const categoryId = categories[d.category] ? d.category : categories[slugify(String(d.category))] ? slugify(String(d.category)) : 'softdrinks';
    const p: Product = {
      name: clip(d.name, 40),
      categoryId,
      priceCents: cents(d.price),
      soldOut: false,
      popular: false,
      sort: 100 + custom,
      active: true,
      ...(d.size ? { size: clip(d.size, 20) } : {}),
      ...(d.description ? { description: clip(d.description, 80) } : {}),
    };
    products[id] = p;
    custom++;
    report.push(`  + eigenes Getränk: ${p.name} (${(p.priceCents / 100).toFixed(2)} €, ${categoryId}) – ohne Foto, Kategorie-Bild als Ersatz`);
  }
  report.push(`Katalog: ${Object.keys(products).length} Produkte (${overridden} mit geänderten Daten aus der alten Verwaltung, ${custom} eigene Getränke), ${Object.keys(categories).length} Kategorien`);
  for (const p of Object.values(products)) p.soldOut = false;
  return catalog;
}

interface TableMap {
  tables: Record<string, Table>;
  /** Old table number → new table id. */
  byNumber: Record<string, string>;
}

function buildTables(legacy: Json, extraNumbers: string[]): TableMap {
  const tables: Record<string, Table> = {};
  const byNumber: Record<string, string> = {};
  const add = (number: string, label: string, sort: number) => {
    const id = Number(number) < 1000 ? `t${number}` : `t-${slugify(label)}`;
    byNumber[number] = id;
    // Deliberately no real guest code: the archive event is closed and must never answer a QR scan.
    tables[id] ??= { label: clip(label, 12), guestCode: '', sort };
  };
  for (const [, t] of entries(legacy.tables)) {
    if (t?.isActive === false || t?.number == null) continue;
    add(String(t.number), String(t.name ?? t.number), Number(t.number));
  }
  for (const n of extraNumbers) if (!byNumber[n]) add(n, n, Number(n) || 9999);
  return { tables, byNumber };
}

function buildBars(legacy: Json, byNumber: Record<string, string>): Record<string, Bar> {
  const bars: Record<string, Bar> = {};
  for (const t of asList<Json>(legacy.settings?.theken)) {
    if (!t?.name) continue;
    const tableIds = asList<number | string>(t.assignedTables).map(n => byNumber[String(n)]).filter(Boolean);
    bars[slugify(t.id ?? t.name)] = { name: clip(t.name, 30), tableIds };
  }
  return Object.keys(bars).length ? bars : { main: { name: 'Theke', tableIds: [] } };
}

/** Old statistics (euros as floats, keyed by product *name*) → cents, keyed by product id. */
export function convertStats(
  s: Json,
  catalog: Catalog,
  byNumber: Record<string, string>,
  report: string[],
): Stats {
  const idByName = new Map(Object.entries(catalog.products).map(([id, p]) => [normName(p.name), id]));
  const stats: Stats = { totalOrders: 0, totalCents: 0, byProduct: {}, byTable: {}, byWaiter: {} };
  stats.totalOrders = Math.round(Number(s.totalOrders) || 0);
  stats.totalCents = cents(s.totalAmount);

  const unmapped: string[] = [];
  for (const [name, v] of entries(s.itemTotals)) {
    let id = idByName.get(normName(name));
    if (!id) {
      id = `legacy-${slugify(name)}`;
      unmapped.push(name);
    }
    const prev = stats.byProduct[id];
    stats.byProduct[id] = {
      name: prev?.name ?? clip(name, 40),
      qty: (prev?.qty ?? 0) + Math.round(Number(v.quantity) || 0),
      cents: (prev?.cents ?? 0) + cents(v.amount),
    };
  }
  for (const [num, t] of entries(s.tables)) {
    const id = byNumber[num] ?? `t${num}`;
    stats.byTable[id] = { orders: Math.round(Number(t.totalOrders) || 0), cents: cents(t.totalAmount) };
  }
  // The old app never recorded who served; keep the totals consistent anyway.
  stats.byWaiter[UNKNOWN_WAITER] = { orders: stats.totalOrders, cents: stats.totalCents, name: 'früher nicht erfasst' };

  const sumProducts = Object.values(stats.byProduct).reduce((n, p) => n + p.cents, 0);
  const sumTables = Object.values(stats.byTable).reduce((n, t) => n + t.cents, 0);
  report.push(`Statistik: ${stats.totalOrders} Bestellungen, ${(stats.totalCents / 100).toFixed(2)} € Umsatz, ${Object.keys(stats.byProduct).length} Artikel, ${Object.keys(stats.byTable).length} Tische`);
  if (unmapped.length) report.push(`! ${unmapped.length} Artikelnamen ohne Gegenstück im Katalog, als „legacy-…“ übernommen: ${unmapped.join(', ')}`);
  if (sumProducts !== stats.totalCents) report.push(`! Summe der Artikel (${(sumProducts / 100).toFixed(2)} €) weicht vom Gesamtumsatz ab (${(stats.totalCents / 100).toFixed(2)} €) – Differenz stammt aus dem alten System (Rundung/Fehler beim Überschreiben).`);
  if (sumTables !== stats.totalCents) report.push(`! Summe der Tische (${(sumTables / 100).toFixed(2)} €) weicht vom Gesamtumsatz ab (${(stats.totalCents / 100).toFixed(2)} €).`);
  return stats;
}

function eventWrites(
  id: string,
  name: string,
  startsAt: number,
  endsAt: number,
  legacy: Json,
  catalog: Catalog,
  tableMap: TableMap,
  bars: Record<string, Bar>,
  stats: Stats,
  now: number,
): Record<string, unknown> {
  const colors = legacy.settings?.colors ?? {};
  const pub: EventPublic = {
    name: clip(name, 40),
    status: 'closed',
    mode: 'tables',
    startsAt,
    endsAt,
    language: legacy.settings?.language === 'hochdeutsch' ? 'hochdeutsch' : 'koelsch',
    archiveMinutes: Math.min(240, Math.max(1, Math.round(Number(legacy.settings?.orderAutoHideMinutes) || 10))),
    accent: {
      primary: HEX.test(colors.primaryTisch) ? colors.primaryTisch : '#009640',
      secondary: HEX.test(colors.secondaryTisch) ? colors.secondaryTisch : '#FFCC00',
    },
  };
  const index: EventIndexEntry = { name: pub.name, status: 'closed', mode: 'tables', startsAt, endsAt, createdAt: now };
  const e = `events/${id}`;
  return {
    [`${e}/public`]: pub,
    [`eventIndex/${id}`]: index,
    [`${e}/catalog`]: catalog,
    [`${e}/tables`]: tableMap.tables,
    [`${e}/bars`]: bars,
    [`${e}/gen`]: { waiter: 1, bar: 1 },
    [`${e}/system`]: { shutdown: true, ordersPaused: true },
    [`${e}/stats`]: stats,
  };
}

/** Pure transformation: legacy export in, database writes out. */
export function buildPlan(legacy: Json, opts: Options): Plan {
  const report: string[] = [];
  const writes: Record<string, unknown> = {};

  const catalog = buildCatalog(legacy, report);
  const statTableNumbers = entries(legacy.statistics?.tables).map(([n]) => n);
  const tableMap = buildTables(legacy, statTableNumbers);
  const bars = buildBars(legacy, tableMap.byNumber);
  report.push(`Tische: ${Object.keys(tableMap.tables).length} (ohne Codes – die alten Codes werden nie übernommen), Theken: ${Object.keys(bars).length}`);

  const stats = convertStats(legacy.statistics ?? {}, catalog, tableMap.byNumber, report);
  Object.assign(writes, eventWrites(opts.id, opts.name, opts.startsAt, opts.endsAt, legacy, catalog, tableMap, bars, stats, opts.now));

  // Table plans (pictures) stay with the archive event; the rules cap them at 1.5 MB each.
  for (const p of asList<Json>(legacy.settings?.tablePlans)) {
    if (typeof p?.image !== 'string' || p.image.length > 1_500_000) continue;
    writes[`events/${opts.id}/plans/${slugify(String(p.id ?? p.name))}`] = { name: clip(p.name ?? 'Plan', 40), image: p.image };
  }

  // Older resets of the statistics.
  const history = entries(legacy.statisticsHistory).sort((a, b) => (a[1].timestamp ?? 0) - (b[1].timestamp ?? 0));
  if (history.length && !opts.history) report.push(`${history.length} ältere Statistik-Stände (statisticsHistory) nicht übernommen – mit --history werden sie eigene Archiv-Veranstaltungen.`);
  if (opts.history) {
    history.forEach(([, h], i) => {
      const at = new Date(h.timestamp ?? opts.now);
      const hs = convertStats(h.statistics ?? {}, catalog, tableMap.byNumber, report);
      if (!hs.totalOrders) return;
      const stamp = at.toISOString().slice(0, 10);
      Object.assign(writes, eventWrites(`${opts.id}-archiv-${i + 1}`, `${opts.name} – Stand ${stamp}`, at.getTime() - 3600_000, at.getTime(), legacy, catalog, tableMap, bars, hs, opts.now));
    });
  }

  // Ratings → feedback (only the fields the rules allow; table codes are dropped).
  let ratings = 0;
  for (const [rid, r] of entries(legacy.ratings)) {
    const rating = Math.round(Number(r?.rating));
    if (!(rating >= 1 && rating <= 5)) continue;
    writes[`feedback/mig-${slugify(rid)}`] = {
      rating,
      ...(r.name ? { name: clip(r.name, 60) } : {}),
      ...(r.email ? { email: clip(r.email, 120) } : {}),
      ...(r.message ? { message: clip(r.message, 600) } : {}),
      eventId: opts.id,
      createdAt: Number(r.timestamp) || opts.now,
    };
    ratings++;
  }
  report.push(`Bewertungen: ${ratings} übernommen`);

  // Things that stay behind on purpose.
  const open = entries(legacy.orders).length;
  if (open) report.push(`! ${open} noch offene Bestellungen im Altsystem – werden nicht übernommen und nirgends mitgezählt. Vorher abarbeiten.`);
  if (legacy.settings?.pinProtection?.adminPin || legacy.settings?.masterPassword) report.push('Alte PIN/Passwörter: nicht übernommen (Admin-PIN wird neu mit scripts/set-admin-pin.mjs gesetzt).');
  report.push('Nicht übernommen: Tisch-Codes, Kellner-Zuordnungen, Push-Tokens, Systemschalter, Durchsagen, Logo (Base64).');
  return { writes, report };
}

// ───────────────────────────── command line ─────────────────────────────

const DEMO_DB = 'http://127.0.0.1:9000';
const DEMO_NS = 'demo-karneval';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function parseDay(value: string | undefined, fallback: string, endOfDay: boolean): number {
  const t = new Date(`${value ?? fallback}T${endOfDay ? '23:59:59' : '00:00:00'}`).getTime(); // local time of this computer
  if (Number.isNaN(t)) throw new Error(`Ungültiges Datum: ${value} (erwartet JJJJ-MM-TT)`);
  return t;
}

async function accessToken(): Promise<string> {
  // google-auth-library ships with firebase-tools; it reads GOOGLE_APPLICATION_CREDENTIALS.
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.database', 'https://www.googleapis.com/auth/userinfo.email'] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('Kein Zugriffstoken – GOOGLE_APPLICATION_CREDENTIALS gesetzt?');
  return token;
}

async function main() {
  const fetchUrl = arg('fetch');
  if (fetchUrl) {
    const res = await fetch(`${fetchUrl.replace(/\/$/, '')}/.json`);
    if (!res.ok) throw new Error(`Export fehlgeschlagen: ${res.status} ${await res.text()}`);
    const file = arg('backup') ?? `backups/legacy-${new Date().toISOString().slice(0, 10)}.json`;
    mkdirSync(dirname(file), { recursive: true });
    const text = await res.text();
    writeFileSync(file, text);
    const top = Object.keys(JSON.parse(text) ?? {});
    console.log(`Sicherung gespeichert: ${file} (${(text.length / 1024).toFixed(0)} KB, Bereiche: ${top.join(', ')})`);
    return;
  }

  const input = arg('in');
  if (!input) throw new Error('Nutzung: --fetch <url> | --in <export.json> [--out plan.json] [--apply --target emulator|<url>]');
  const legacy = JSON.parse(readFileSync(input, 'utf8')) as Json;
  if (!legacy || typeof legacy !== 'object') throw new Error('Die Sicherung ist leer oder kein JSON-Objekt.');

  const opts: Options = {
    id: arg('id') ?? 'karneval-2026',
    name: arg('name') ?? 'Karneval 2026',
    startsAt: parseDay(arg('start'), '2026-02-12', false),
    endsAt: parseDay(arg('end'), '2026-02-18', true),
    history: flag('history'),
    now: Date.now(),
  };
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(opts.id)) throw new Error('--id: nur Buchstaben, Ziffern, "-" und "_"');

  const { writes, report } = buildPlan(legacy, opts);
  console.log(`\nMigration → Veranstaltung „${opts.name}“ (${opts.id}, beendet)\n`);
  for (const line of report) console.log(line.startsWith('!') ? `⚠ ${line.slice(2)}` : `• ${line}`);
  console.log(`\n${Object.keys(writes).length} Datenbank-Pfade.`);

  const out = arg('out');
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(writes, null, 2));
    console.log(`Plan geschrieben: ${out}`);
  }
  if (!flag('apply')) {
    console.log('\nTrockenlauf – es wurde nichts geschrieben. Mit --apply --target emulator|<url> ausführen.');
    return;
  }

  const target = arg('target');
  if (!target) throw new Error('--apply braucht --target emulator oder die Realtime-Database-URL des neuen Projekts.');
  const emulator = target === 'emulator';
  const base = emulator ? DEMO_DB : target.replace(/\/$/, '');
  const auth = emulator ? { Authorization: 'Bearer owner' } : { Authorization: `Bearer ${await accessToken()}` };
  const q = emulator ? `?ns=${DEMO_NS}` : '';

  // Never overwrite an existing event of the same id (e.g. when the script runs twice).
  const existing = await fetch(`${base}/events/${opts.id}/public/status.json${q}`, { headers: auth });
  if (!existing.ok) throw new Error(`Zugriff auf ${base} fehlgeschlagen: ${existing.status} ${await existing.text()}`);
  if ((await existing.json()) !== null && !flag('force')) throw new Error(`events/${opts.id} gibt es schon im Ziel. Anderes --id wählen oder --force.`);

  const res = await fetch(`${base}/.json${q}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(writes) });
  if (!res.ok) throw new Error(`Schreiben fehlgeschlagen: ${res.status} ${await res.text()}`);
  console.log(`\nFertig: ${Object.keys(writes).length} Pfade nach ${emulator ? 'Emulator' : base} geschrieben.`);
}

if ((import.meta as { main?: boolean }).main) {
  main().catch(e => {
    console.error(`\nFehler: ${(e as Error).message}`);
    process.exit(1);
  });
}
