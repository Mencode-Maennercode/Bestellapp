import { NO_TABLE, UNKNOWN_WAITER } from './stats';
import { shareCents } from './money';
import type { Stats, Table } from './types';

// Pure helpers for the admin's statistics view and CSV export. Money stays in integer cents.

/** PräsenzWert share of the revenue: 1.5 %. */
export const COMMISSION_PERMILLE = 15;
export const commissionCents = (totalCents: number) => shareCents(totalCents, COMMISSION_PERMILLE);

export interface StatLine {
  id: string;
  name: string;
  /** Pieces (products) or orders (tables, waiters). */
  count: number;
  cents: number;
}

const rec = <T>(v: Record<string, T> | null | undefined): [string, T][] => Object.entries(v ?? {});
const byCents = (a: StatLine, b: StatLine) => b.cents - a.cents || b.count - a.count || a.name.localeCompare(b.name, 'de');

export function productLines(stats: Stats | null | undefined): StatLine[] {
  return rec(stats?.byProduct)
    .map(([id, p]) => ({ id, name: p.name ?? id, count: p.qty ?? 0, cents: p.cents ?? 0 }))
    .filter(l => l.count !== 0 || l.cents !== 0)
    .sort(byCents);
}

export function tableLines(stats: Stats | null | undefined, tables: Record<string, Pick<Table, 'label'>> | null | undefined): StatLine[] {
  return rec(stats?.byTable)
    .map(([id, t]) => ({ id, name: id === NO_TABLE ? 'Ohne Tisch (Bons)' : (tables?.[id]?.label ?? id), count: t.orders ?? 0, cents: t.cents ?? 0 }))
    .filter(l => l.count !== 0 || l.cents !== 0)
    .sort(byCents);
}

export function waiterLines(stats: Stats | null | undefined): StatLine[] {
  return rec(stats?.byWaiter)
    .map(([id, w]) => ({ id, name: id === UNKNOWN_WAITER ? (w.name ?? 'nicht zugeordnet') : (w.name ?? 'Unbekannt'), count: w.orders ?? 0, cents: w.cents ?? 0 }))
    .filter(l => l.count !== 0 || l.cents !== 0)
    .sort(byCents);
}

/** The three breakdowns must add up to the total; a difference points to old data or a bug. */
export function consistency(stats: Stats | null | undefined) {
  const total = stats?.totalCents ?? 0;
  const sum = (lines: StatLine[]) => lines.reduce((n, l) => n + l.cents, 0);
  const parts = { products: sum(productLines(stats)), tables: sum(tableLines(stats, null)), waiters: sum(waiterLines(stats)) };
  return { total, ...parts, ok: parts.products === total && parts.tables === total && parts.waiters === total };
}

/** "12,50" for Excel in German locale (no currency sign, no thousands separator). */
export const plainEUR = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`;

const cell = (v: string | number) => {
  const s = String(v);
  // Cells starting with = + - @ would be run as formulas by spreadsheets: neutralise them.
  const safe = /^[=+@]/.test(s) || /^-(?!\d)/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Semicolon-separated CSV with BOM, opens correctly in German Excel. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  return `\uFEFF${[header, ...rows].map(r => r.map(cell).join(';')).join('\r\n')}\r\n`;
}

export const linesToCsv = (kind: string, countLabel: string, lines: StatLine[]) =>
  toCsv([kind, countLabel, 'Umsatz (EUR)'], lines.map(l => [l.name, l.count, plainEUR(l.cents)]));
