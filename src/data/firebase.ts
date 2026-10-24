import { initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import type { Functions } from 'firebase/functions';

const env = import.meta.env;
export const useEmulators = env.VITE_USE_EMULATORS === '1';

// Each staff page gets its own app name, so its login is stored separately: admin, Theke and Kellner
// open in one browser no longer sign each other out.
const page = typeof location === 'undefined' ? undefined : location.pathname.match(/\/(kellner|theke|admin)\//)?.[1];

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: useEmulators ? 'http://127.0.0.1:9000?ns=demo-karneval' : env.VITE_FIREBASE_DATABASE_URL,
  projectId: useEmulators ? 'demo-karneval' : env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}, page ?? '[DEFAULT]');

export const db = getDatabase(app);
if (useEmulators) connectDatabaseEmulator(db, '127.0.0.1', 9000);

// Login lives in ./auth (staff and admin pages only); guests never load it.

let functionsReady: Promise<Functions> | null = null;
/** The Functions SDK is only needed when something is sent (an order, a call, a login), so it loads then. */
export function functions(): Promise<Functions> {
  functionsReady ??= import('firebase/functions').then(({ connectFunctionsEmulator, getFunctions }) => {
    const fns = getFunctions(app, 'europe-west1');
    if (useEmulators) connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    return fns;
  });
  return functionsReady;
}
