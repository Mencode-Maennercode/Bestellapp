import type { Bar, Catalog, Order, WaiterProfile } from './types';

// What waiters and the bar see. Pure functions so the rules are testable without a browser.

export type Entry = [id: string, order: Order];

/** A waiter counts as present while their app reported in within this window. */
export const ACTIVE_WAITER_MS = 15 * 60 * 1000;

const byCreated = (a: Entry, b: Entry) => a[1].createdAt - b[1].createdAt;
const list = <T>(v: T[] | Record<string, T> | null | undefined): T[] => (Array.isArray(v) ? v : Object.values(v ?? {}));

export interface WaiterLists {
  /** Mine to act on: my tables (unclaimed or claimed by me), anything I claimed, my own tabs. Oldest first. */
  mine: Entry[];
  /** Unclaimed orders for tables no present waiter covers, so nobody waits unseen. */
  orphan: Entry[];
  /** My tables, but a colleague took them. */
  colleagues: Entry[];
}

export function waiterLists(
  orders: Record<string, Order>,
  me: { uid: string; tableIds: string[] },
  waiters: Record<string, WaiterProfile>,
  now: number,
): WaiterLists {
  const mineTables = new Set(me.tableIds);
  const covered = new Set<string>(mineTables);
  for (const [uid, w] of Object.entries(waiters)) {
    if (uid !== me.uid && now - (w.lastSeen ?? 0) < ACTIVE_WAITER_MS) list(w.tableIds).forEach(t => covered.add(t));
  }

  const out: WaiterLists = { mine: [], orphan: [], colleagues: [] };
  for (const e of Object.entries(orders)) {
    const o = e[1];
    if (!o.open) continue;
    // Tabs are private notes: only their owner ever sees them.
    if (o.type === 'tab') {
      if (o.waiterUid === me.uid) out.mine.push(e);
      continue;
    }
    if (o.claimedBy?.uid === me.uid) out.mine.push(e);
    else if (o.tableId && mineTables.has(o.tableId)) (o.claimedBy ? out.colleagues : out.mine).push(e);
    else if (!o.claimedBy && (!o.tableId || !covered.has(o.tableId))) out.orphan.push(e);
  }
  out.mine.sort(byCreated);
  out.orphan.sort(byCreated);
  out.colleagues.sort(byCreated);
  return out;
}

/** Orders that should ring the alarm for this waiter: new, unclaimed, on my tables, not placed by me. */
export function alarmCandidates(orders: Record<string, Order>, me: { uid: string; tableIds: string[] }): string[] {
  const mine = new Set(me.tableIds);
  return Object.entries(orders)
    .filter(([, o]) => o.open && !o.claimedBy && o.type !== 'tab' && o.waiterUid !== me.uid && !!o.tableId && mine.has(o.tableId))
    .map(([id]) => id);
}

export const ALL_BARS = '_alle';

/** The one bar responsible for a table: the bar listing it, else a bar serving "all tables", else the first bar. */
export function barFor(tableId: string | undefined, bars: Record<string, Bar>): string | undefined {
  const ids = Object.keys(bars).sort();
  if (tableId) {
    const listed = ids.find(id => list(bars[id].tableIds).includes(tableId));
    if (listed) return listed;
  }
  return ids.find(id => !list(bars[id].tableIds).length) ?? ids[0];
}

export interface BarLists {
  /** Still to prepare, oldest first. */
  todo: Entry[];
  /** Prepared, waiting for the waiter to pick up. */
  ready: Entry[];
}

export function barLists(orders: Record<string, Order>, barId: string, bars: Record<string, Bar>): BarLists {
  const out: BarLists = { todo: [], ready: [] };
  for (const e of Object.entries(orders)) {
    const o = e[1];
    if (!o.open || !o.sendToBar || o.type === 'call') continue;
    if (barId !== ALL_BARS && barFor(o.tableId, bars) !== barId) continue;
    (o.readyAt ? out.ready : out.todo).push(e);
  }
  out.todo.sort(byCreated);
  out.ready.sort((a, b) => (a[1].readyAt ?? 0) - (b[1].readyAt ?? 0));
  return out;
}

export interface TallyLine {
  productId: string;
  name: string;
  qty: number;
}

/** "12× Kölsch, 4× Cola" over all open bar orders; empty glasses listed separately. */
export function tally(entries: Entry[], catalog: Catalog): { drinks: TallyLine[]; glasses: TallyLine[] } {
  const sum = new Map<string, TallyLine>();
  for (const [, o] of entries) {
    for (const i of o.items) {
      const line = sum.get(i.productId) ?? { productId: i.productId, name: catalog.products[i.productId]?.name ?? i.name, qty: 0 };
      line.qty += i.qty;
      sum.set(i.productId, line);
    }
  }
  const sorted = [...sum.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'de'));
  const isGlass = (l: TallyLine) => !!catalog.products[l.productId]?.glassFor;
  return { drinks: sorted.filter(l => !isGlass(l)), glasses: sorted.filter(isGlass) };
}
