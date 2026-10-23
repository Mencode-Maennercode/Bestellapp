import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defaultCatalog } from '../../shared/catalog-seed';
import { GUEST_CODE_LENGTH, STAFF_TOKEN_LENGTH } from '../../shared/codes';
import { EVENT_GRACE_MS } from '../../shared/event-window';
import { createEventInput, eventIdInput, rotateLinkInput, setTablesInput, updateEventInput } from '../../shared/schemas';
import type { Bar, Catalog, EventIndexEntry, EventPublic, StaffRole, Table } from '../../shared/types';
import { REGION, db, fail, newCode, parse, paths, read, requireAdmin, sha256 } from './core';

const ROLES: StaffRole[] = ['waiter', 'bar'];
type Tokens = Partial<Record<StaffRole, string>>;

const defaultPublic = (): Omit<EventPublic, 'name' | 'startsAt' | 'endsAt' | 'mode'> => ({
  status: 'draft',
  language: 'koelsch',
  archiveMinutes: 10,
  accent: { primary: '#009640', secondary: '#FFCC00' },
});

const indexEntry = (pub: EventPublic, createdAt: number): EventIndexEntry => ({
  name: pub.name,
  status: pub.status,
  mode: pub.mode,
  startsAt: pub.startsAt,
  endsAt: pub.endsAt,
  createdAt,
  ...(pub.slug ? { slug: pub.slug } : {}),
});

/**
 * Fresh link tokens for `roles`; returns the multi-path update that stores them and drops the old ones.
 * Waiter and bar links are independent: rotating one never touches the other.
 */
function linkUpdate(eventId: string, roles: StaffRole[], old: Tokens): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const role of roles) {
    const token = newCode(STAFF_TOKEN_LENGTH);
    update[paths.staffToken(sha256(token))] = { eventId, role };
    update[`${paths.eventStaffToken(eventId)}/${role}`] = token;
    if (old[role]) update[paths.staffToken(sha256(old[role]!))] = null;
  }
  return update;
}

async function readPublic(eventId: string): Promise<EventPublic> {
  const pub = await read<EventPublic>(paths.pub(eventId));
  if (!pub) fail('not-found', 'eventNotFound');
  return pub;
}

/** Closed events are final: no new codes, no reopening, nothing that could revive an old link. */
async function openEvent(eventId: string): Promise<EventPublic> {
  const pub = await readPublic(eventId);
  if (pub.status === 'closed') fail('failed-precondition', 'eventClosed');
  return pub;
}

/** New event, optionally copied from an earlier one. Guest codes and both staff links are always new. */
export const createEvent = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const input = parse(createEventInput, req.data);
  const eventId = db.ref('events').push().key!;
  const now = Date.now();

  let catalog: Catalog = defaultCatalog();
  let base = defaultPublic();
  let bars: Record<string, Bar> = { main: { name: 'Theke', tableIds: [] } };
  let tables: Record<string, Table> = {};

  if (input.copyFrom) {
    const src = await read<{ public: EventPublic; catalog: Catalog; bars?: Record<string, Bar>; tables?: Record<string, Table> }>(
      paths.event(input.copyFrom),
    );
    if (!src) fail('not-found', 'eventNotFound');
    catalog = src.catalog;
    for (const p of Object.values(catalog.products ?? {})) p.soldOut = false;
    base = { ...defaultPublic(), language: src.public.language, archiveMinutes: src.public.archiveMinutes, accent: src.public.accent };
    bars = src.bars ?? bars;
    tables = src.tables ?? {};
  }

  const pub: EventPublic = {
    ...base,
    name: input.name,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    mode: input.mode,
    ...(input.slug ? { slug: input.slug } : {}),
  };
  const update: Record<string, unknown> = {
    [paths.pub(eventId)]: pub,
    [paths.eventIndex(eventId)]: indexEntry(pub, now),
    [paths.catalog(eventId)]: catalog,
    [`${paths.event(eventId)}/bars`]: bars,
    [`${paths.event(eventId)}/gen`]: { waiter: 0, bar: 0 },
    [paths.system(eventId)]: { shutdown: false, ordersPaused: false },
  };
  // Same table ids and labels (so bar assignments stay valid), but new guest codes.
  if (input.mode === 'tables') {
    for (const [id, t] of Object.entries(tables)) {
      const guestCode = newCode(GUEST_CODE_LENGTH);
      update[`${paths.tables(eventId)}/${id}`] = { ...t, guestCode };
      update[paths.guestCode(guestCode)] = { eventId, tableId: id };
    }
  }
  Object.assign(update, linkUpdate(eventId, ROLES, {}));
  await db.ref().update(update);
  return { eventId };
});

/** Name, times, look, folder name and draft ↔ live. Keeps the admin's event list in sync. */
export const updateEvent = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId, slug, ...patch } = parse(updateEventInput, req.data);
  const cur = await openEvent(eventId);
  const next: EventPublic = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
  if (slug === null) delete next.slug;
  else if (slug) next.slug = slug;
  if (next.endsAt <= next.startsAt) fail('failed-precondition', 'badTimes');

  const createdAt = (await read<number>(`${paths.eventIndex(eventId)}/createdAt`)) ?? Date.now();
  await db.ref().update({ [paths.pub(eventId)]: next, [paths.eventIndex(eventId)]: indexEntry(next, createdAt) });
  return { ok: true };
});

/**
 * Ends an event for good and kills everything that could still work afterwards:
 * both staff links and their sessions, the guests' status view. Guest codes keep pointing at the
 * closed event so scanning an old QR code says "beendet" instead of "unbekannt".
 */
export async function teardownEvent(eventId: string): Promise<void> {
  const pub = await readPublic(eventId);
  const [tokens, genW, genB, createdAt] = await Promise.all([
    read<Tokens>(paths.eventStaffToken(eventId)),
    read<number>(paths.gen(eventId, 'waiter')),
    read<number>(paths.gen(eventId, 'bar')),
    read<number>(`${paths.eventIndex(eventId)}/createdAt`),
  ]);
  const closed: EventPublic = { ...pub, status: 'closed' };
  const update: Record<string, unknown> = {
    [`${paths.pub(eventId)}/status`]: 'closed',
    [paths.eventIndex(eventId)]: indexEntry(closed, createdAt ?? Date.now()),
    [paths.gen(eventId, 'waiter')]: (genW ?? 0) + 1,
    [paths.gen(eventId, 'bar')]: (genB ?? 0) + 1,
    [paths.eventStaffToken(eventId)]: null,
    [`${paths.event(eventId)}/tableStatus`]: null,
    [`${paths.event(eventId)}/limits`]: null,
  };
  for (const role of ROLES) if (tokens?.[role]) update[paths.staffToken(sha256(tokens[role]!))] = null;
  await db.ref().update(update);
}

export const closeEvent = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId } = parse(eventIdInput, req.data);
  await readPublic(eventId);
  await teardownEvent(eventId);
  return { ok: true };
});

/** Events nobody closed by hand are closed once their window plus grace time is over. */
export const closeEndedEvents = onSchedule({ schedule: 'every 60 minutes', region: REGION }, async () => {
  const index = (await read<Record<string, EventIndexEntry>>('eventIndex')) ?? {};
  const now = Date.now();
  for (const [id, e] of Object.entries(index)) {
    if (e.status === 'closed' || now <= e.endsAt + EVENT_GRACE_MS) continue;
    try {
      await teardownEvent(id);
      logger.info('event closed', { id });
    } catch (err) {
      logger.error('closing event failed', { id, err });
    }
  }
});

/** Replaces the table list. Kept tables keep their code; new tables get one; removed codes stop working. */
export const setTables = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId, tables } = parse(setTablesInput, req.data);
  await openEvent(eventId);
  const current = (await read<Record<string, Table>>(paths.tables(eventId))) ?? {};
  const update: Record<string, unknown> = {};
  const keep = new Set<string>();

  tables.forEach((t, i) => {
    const existing = t.id ? current[t.id] : undefined;
    const id = existing ? t.id! : db.ref(paths.tables(eventId)).push().key!;
    const guestCode = existing?.guestCode ?? newCode(GUEST_CODE_LENGTH);
    keep.add(id);
    update[`${paths.tables(eventId)}/${id}`] = { label: t.label, guestCode, sort: i + 1 };
    if (!existing) update[paths.guestCode(guestCode)] = { eventId, tableId: id };
  });
  for (const [id, t] of Object.entries(current)) {
    if (keep.has(id)) continue;
    update[`${paths.tables(eventId)}/${id}`] = null;
    update[paths.guestCode(t.guestCode)] = null;
  }
  // A bar must not keep pointing at a table that no longer exists.
  const bars = (await read<Record<string, Bar>>(`${paths.event(eventId)}/bars`)) ?? {};
  for (const [barId, bar] of Object.entries(bars)) {
    const ids = (bar.tableIds ?? []).filter(t => keep.has(t));
    if (ids.length !== (bar.tableIds ?? []).length) update[`${paths.event(eventId)}/bars/${barId}/tableIds`] = ids;
  }
  await db.ref().update(update);
  return { ok: true };
});

/** New guest codes for every table (e.g. after QR codes leaked). Old codes stop working at once. */
export const regenerateGuestCodes = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId } = parse(eventIdInput, req.data);
  await openEvent(eventId);
  const current = (await read<Record<string, Table>>(paths.tables(eventId))) ?? {};
  const update: Record<string, unknown> = {};
  for (const [id, t] of Object.entries(current)) {
    const guestCode = newCode(GUEST_CODE_LENGTH);
    update[paths.guestCode(t.guestCode)] = null;
    update[paths.guestCode(guestCode)] = { eventId, tableId: id };
    update[`${paths.tables(eventId)}/${id}/guestCode`] = guestCode;
    update[`${paths.event(eventId)}/tableStatus/${t.guestCode}`] = null;
  }
  await db.ref().update(update);
  return { ok: true };
});

/** New waiter and/or bar link. Devices using the old link are locked out immediately. */
export const rotateStaffLink = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId, role } = parse(rotateLinkInput, req.data);
  await openEvent(eventId);
  const roles = role === 'both' ? ROLES : [role];
  const old = (await read<Tokens>(paths.eventStaffToken(eventId))) ?? {};
  const update = linkUpdate(eventId, roles, old);
  for (const r of roles) update[paths.gen(eventId, r)] = ((await read<number>(paths.gen(eventId, r))) ?? 0) + 1;
  await db.ref().update(update);
  return { ok: true };
});
