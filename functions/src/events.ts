import { onCall } from 'firebase-functions/v2/https';
import { defaultCatalog } from '../../shared/catalog-seed';
import { GUEST_CODE_LENGTH, STAFF_TOKEN_LENGTH } from '../../shared/codes';
import { createEventInput, eventIdInput, setTablesInput } from '../../shared/schemas';
import type { Bar, Catalog, EventPublic, Table } from '../../shared/types';
import { REGION, db, fail, newCode, parse, paths, read, requireAdmin, sha256 } from './core';

const defaultPublic = (): Omit<EventPublic, 'name' | 'startsAt' | 'endsAt' | 'mode'> => ({
  status: 'draft',
  language: 'koelsch',
  archiveMinutes: 10,
  accent: { primary: '#009640', secondary: '#FFCC00' },
});

/** Fresh staff link token; returns the multi-path update that stores it. */
function staffTokenUpdate(eventId: string, oldToken: string | null): { token: string; update: Record<string, unknown> } {
  const token = newCode(STAFF_TOKEN_LENGTH);
  const update: Record<string, unknown> = {
    [paths.staffToken(sha256(token))]: { eventId },
    [paths.eventStaffToken(eventId)]: token,
  };
  if (oldToken) update[paths.staffToken(sha256(oldToken))] = null;
  return { token, update };
}

/** New event, optionally copied from an earlier one. Guest codes and staff link are always new. */
export const createEvent = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const input = parse(createEventInput, req.data);
  const eventId = db.ref('events').push().key!;

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

  const update: Record<string, unknown> = {
    [paths.pub(eventId)]: { ...base, name: input.name, startsAt: input.startsAt, endsAt: input.endsAt, mode: input.mode },
    [paths.catalog(eventId)]: catalog,
    [`${paths.event(eventId)}/bars`]: bars,
    [paths.staffGen(eventId)]: 0,
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
  Object.assign(update, staffTokenUpdate(eventId, null).update);
  await db.ref().update(update);
  return { eventId };
});

/** Replaces the table list. Kept tables keep their code; new tables get one; removed codes stop working. */
export const setTables = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId, tables } = parse(setTablesInput, req.data);
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
  await db.ref().update(update);
  return { ok: true };
});

/** New guest codes for every table (e.g. after QR codes leaked). Old codes stop working at once. */
export const regenerateGuestCodes = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId } = parse(eventIdInput, req.data);
  const current = (await read<Record<string, Table>>(paths.tables(eventId))) ?? {};
  const update: Record<string, unknown> = {};
  for (const [id, t] of Object.entries(current)) {
    const guestCode = newCode(GUEST_CODE_LENGTH);
    update[paths.guestCode(t.guestCode)] = null;
    update[paths.guestCode(guestCode)] = { eventId, tableId: id };
    update[`${paths.tables(eventId)}/${id}/guestCode`] = guestCode;
  }
  await db.ref().update(update);
  return { ok: true };
});

/** New staff link. Devices using the old link are locked out immediately. */
export const rotateStaffLink = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { eventId } = parse(eventIdInput, req.data);
  const [old, gen] = await Promise.all([read<string>(paths.eventStaffToken(eventId)), read<number>(paths.staffGen(eventId))]);
  const { update } = staffTokenUpdate(eventId, old);
  update[paths.staffGen(eventId)] = (gen ?? 0) + 1;
  await db.ref().update(update);
  return { ok: true };
});
