import { signInWithCustomToken, signOut } from 'firebase/auth';
import { TOKEN_PATTERN } from '@shared/codes';
import { api } from './api';
import { auth } from './auth';
import { hashParam } from './hash';

export type StaffRole = 'waiter' | 'bar';

interface SessionClaims {
  role?: StaffRole | 'admin';
  eventId?: string;
  until?: number;
}

async function currentClaims(): Promise<SessionClaims | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return (await user.getIdTokenResult()).claims as SessionClaims;
}

/** Waiter and bar links are remembered separately on a device. */
const linkKey = (role: StaffRole) => `staffLink:${role}`;

function storedLink(role: StaffRole): string | null {
  try {
    return localStorage.getItem(linkKey(role));
  } catch {
    return null; // storage blocked: simply log in again
  }
}

/**
 * Silent staff login from the link token in the URL. Reuses the device session while it belongs
 * to the same link and has not expired; otherwise exchanges the token for a fresh session.
 */
export async function ensureStaffSession(token: string, role: StaffRole, refresh = false): Promise<{ eventId: string; uid: string; role: StaffRole }> {
  if (refresh) await auth.authStateReady().then(() => auth.currentUser?.getIdToken(true)).catch(() => undefined);
  const c = await currentClaims();
  if (c?.role === role && c.eventId && (c.until ?? 0) > Date.now() && storedLink(role) === token) {
    return { eventId: c.eventId, uid: auth.currentUser!.uid, role };
  }
  const session = await api.staffSession(token);
  const cred = await signInWithCustomToken(auth, session.customToken);
  try {
    localStorage.setItem(linkKey(session.role), token);
  } catch {
    /* ignore */
  }
  return { eventId: session.eventId, uid: cred.user.uid, role: session.role };
}

/** Forgets the stored link of a role (it turned out to be dead), so a stale device stops retrying it. */
export function forgetStaffLink(role: StaffRole) {
  try {
    localStorage.removeItem(linkKey(role));
  } catch {
    /* ignore */
  }
}

export async function hasAdminSession(): Promise<boolean> {
  const c = await currentClaims();
  return c?.role === 'admin' && (c.until ?? 0) > Date.now();
}

export async function adminLogin(pin: string): Promise<void> {
  const { customToken } = await api.adminSession(pin);
  await signInWithCustomToken(auth, customToken);
}

export const logout = () => signOut(auth);

/**
 * Staff link token from the URL, or the last link opened on this device
 * (so a tap on a push notification without "#…" still works).
 */
export function staffLinkToken(role: StaffRole): string | null {
  const fromHash = hashParam();
  if (TOKEN_PATTERN.test(fromHash)) return fromHash;
  const stored = storedLink(role);
  return stored && TOKEN_PATTERN.test(stored) ? stored : null;
}

