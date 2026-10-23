import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase, type Reference } from 'firebase-admin/database';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { createHash, randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { randomCode } from '../../shared/codes';
import type { Catalog, EventPublic } from '../../shared/types';

initializeApp();

export const db = getDatabase();
export const auth = getAuth();
export const REGION = 'europe-west1';

export const rand = (n: number) => new Uint8Array(randomBytes(n));
export const newCode = (len: number) => randomCode(len, rand);
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const paths = {
  guestCode: (code: string) => `guestCodes/${code}`,
  event: (e: string) => `events/${e}`,
  pub: (e: string) => `events/${e}/public`,
  staffGen: (e: string) => `events/${e}/staffGen`,
  catalog: (e: string) => `events/${e}/catalog`,
  tables: (e: string) => `events/${e}/tables`,
  system: (e: string) => `events/${e}/system`,
  orders: (e: string) => `events/${e}/orders`,
  tableStatus: (e: string, code: string) => `events/${e}/tableStatus/${code}`,
  stats: (e: string) => `events/${e}/stats`,
  waiters: (e: string) => `events/${e}/waiters`,
  limits: (e: string, key: string) => `events/${e}/limits/${key}`,
  staffToken: (hash: string) => `secrets/staffTokens/${hash}`,
  eventStaffToken: (e: string) => `secrets/eventStaffToken/${e}`,
  adminPin: 'secrets/adminPin',
  adminFails: (ipHash: string) => `secrets/adminFails/${ipHash}`,
};

export async function read<T>(path: string): Promise<T | null> {
  return (await db.ref(path).get()).val() as T | null;
}

/** Validates callable input; maps zod errors to a clean HttpsError. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpsError('invalid-argument', 'invalid', { reason: 'invalid' });
  return r.data;
}

export function fail(code: 'failed-precondition' | 'permission-denied' | 'not-found' | 'resource-exhausted' | 'aborted' | 'unauthenticated', reason: string): never {
  throw new HttpsError(code, reason, { reason });
}

export interface Claims {
  role: 'staff' | 'admin';
  eventId?: string;
  /** Staff link generation; rotating the link bumps it and locks out old devices at once. */
  gen?: number;
  until: number;
}

function claimsOf(req: CallableRequest): Claims | null {
  const t = req.auth?.token as Partial<Claims> | undefined;
  if (!t?.role || typeof t.until !== 'number' || t.until < Date.now()) return null;
  return t as Claims;
}

export function requireAdmin(req: CallableRequest): { uid: string } {
  const c = claimsOf(req);
  if (c?.role !== 'admin') fail('permission-denied', 'adminRequired');
  return { uid: req.auth!.uid };
}

/** Staff of this event (current link generation), or an admin. */
export async function requireStaff(req: CallableRequest, eventId: string): Promise<{ uid: string; role: 'staff' | 'admin' }> {
  const c = claimsOf(req);
  if (!c) fail('unauthenticated', 'sessionExpired');
  if (c.role === 'staff') {
    if (c.eventId !== eventId) fail('permission-denied', 'otherEvent');
    if (c.gen !== (await read<number>(paths.staffGen(eventId)))) fail('unauthenticated', 'linkRotated');
  }
  return { uid: req.auth!.uid, role: c.role };
}

export async function loadEvent(e: string): Promise<{ pub: EventPublic; catalog: Catalog }> {
  const [pub, catalog] = await Promise.all([read<EventPublic>(paths.pub(e)), read<Catalog>(paths.catalog(e))]);
  if (!pub || !catalog) fail('not-found', 'eventNotFound');
  return { pub, catalog: { categories: catalog.categories ?? {}, products: catalog.products ?? {} } };
}

/**
 * Atomic per-key rate limit: allows the call only if `field` is older than `minGapMs`.
 * Returns false when limited.
 */
export async function takeSlot(ref: Reference, field: string, minGapMs: number, now: number): Promise<boolean> {
  const r = await ref.transaction((cur: Record<string, number> | null) => {
    if (now - (cur?.[field] ?? 0) < minGapMs) return; // abort: limited
    return { ...(cur ?? {}), [field]: now };
  });
  return r.committed;
}
