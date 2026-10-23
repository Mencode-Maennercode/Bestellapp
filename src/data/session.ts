import { signInWithCustomToken, signOut } from 'firebase/auth';
import { TOKEN_PATTERN } from '@shared/codes';
import { api } from './api';
import { auth } from './firebase';

interface SessionClaims {
  role?: 'staff' | 'admin';
  eventId?: string;
  until?: number;
}

async function currentClaims(): Promise<SessionClaims | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return (await user.getIdTokenResult()).claims as SessionClaims;
}

const LINK_KEY = 'staffLink';

function storedLink(): string | null {
  try {
    return localStorage.getItem(LINK_KEY);
  } catch {
    return null; // storage blocked: simply log in again
  }
}

/**
 * Silent staff login from the link token in the URL. Reuses the device session while it belongs
 * to the same link and has not expired; otherwise exchanges the token for a fresh session.
 */
export async function ensureStaffSession(token: string): Promise<{ eventId: string; uid: string }> {
  const c = await currentClaims();
  if (c?.role === 'staff' && c.eventId && (c.until ?? 0) > Date.now() && storedLink() === token) {
    return { eventId: c.eventId, uid: auth.currentUser!.uid };
  }
  const { customToken, eventId } = await api.staffSession(token);
  const cred = await signInWithCustomToken(auth, customToken);
  try {
    localStorage.setItem(LINK_KEY, token);
  } catch {
    /* ignore */
  }
  return { eventId, uid: cred.user.uid };
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
export function staffLinkToken(): string | null {
  const fromHash = hashParam();
  if (TOKEN_PATTERN.test(fromHash)) return fromHash;
  const stored = storedLink();
  return stored && TOKEN_PATTERN.test(stored) ? stored : null;
}

/** Code or token after "#", e.g. /tisch/#K7M2P9QX4R. Never sent to the web server. */
export function hashParam(): string {
  return decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();
}
