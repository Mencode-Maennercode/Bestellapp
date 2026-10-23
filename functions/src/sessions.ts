import { onCall } from 'firebase-functions/v2/https';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { adminSessionInput, changePinInput, staffSessionInput } from '../../shared/schemas';
import { sessionUntil, EVENT_GRACE_MS } from '../../shared/event-window';
import type { EventPublic, StaffRole } from '../../shared/types';
import { REGION, auth, db, fail, newCode, parse, paths, read, requireAdmin, sha256 } from './core';

const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_PIN_FAILS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

interface PinRecord {
  salt: string;
  hash: string;
}

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')): PinRecord {
  return { salt, hash: scryptSync(pin, salt, 32).toString('hex') };
}

function pinMatches(pin: string, rec: PinRecord): boolean {
  const a = Buffer.from(hashPin(pin, rec.salt).hash, 'hex');
  const b = Buffer.from(rec.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Exchanges a waiter or bar link token for a Firebase session bound to one event and one role. */
export const staffSession = onCall({ region: REGION }, async req => {
  const { token } = parse(staffSessionInput, req.data);
  const link = await read<{ eventId: string; role: StaffRole }>(paths.staffToken(sha256(token)));
  if (!link) fail('permission-denied', 'linkInvalid');

  const pub = await read<EventPublic>(paths.pub(link.eventId));
  if (!pub || pub.status === 'closed' || Date.now() > pub.endsAt + EVENT_GRACE_MS) fail('permission-denied', 'eventEnded');

  const uid = `${link.role}-${link.eventId}-${newCode(12)}`;
  const customToken = await auth.createCustomToken(uid, {
    role: link.role,
    eventId: link.eventId,
    gen: (await read<number>(paths.gen(link.eventId, link.role))) ?? 0,
    until: sessionUntil(pub),
  });
  return { customToken, eventId: link.eventId, role: link.role };
});

async function verifyPinWithLimit(pin: string, ip: string): Promise<boolean> {
  const failsRef = db.ref(paths.adminFails(sha256(ip || 'unknown')));
  const now = Date.now();
  const fails = (await failsRef.get()).val() as { count: number; since: number } | null;
  const active = fails && now - fails.since < PIN_LOCK_MS ? fails : null;
  if (active && active.count >= MAX_PIN_FAILS) fail('resource-exhausted', 'tooManyAttempts');

  const rec = await read<PinRecord>(paths.adminPin);
  if (!rec) fail('failed-precondition', 'pinNotSet');

  if (!pinMatches(pin, rec)) {
    await failsRef.set({ count: (active?.count ?? 0) + 1, since: active?.since ?? now });
    return false;
  }
  if (fails) await failsRef.remove();
  return true;
}

export const adminSession = onCall({ region: REGION }, async req => {
  const { pin } = parse(adminSessionInput, req.data);
  if (!(await verifyPinWithLimit(pin, req.rawRequest.ip ?? ''))) fail('permission-denied', 'wrongPin');
  const customToken = await auth.createCustomToken(`admin-${newCode(12)}`, {
    role: 'admin',
    until: Date.now() + ADMIN_SESSION_MS,
  });
  return { customToken };
});

export const changeAdminPin = onCall({ region: REGION }, async req => {
  requireAdmin(req);
  const { pin, newPin } = parse(changePinInput, req.data);
  if (!(await verifyPinWithLimit(pin, req.rawRequest.ip ?? ''))) fail('permission-denied', 'wrongPin');
  await db.ref(paths.adminPin).set(hashPin(newPin));
  return { ok: true };
});
