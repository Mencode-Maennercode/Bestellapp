import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { app, useEmulators } from './firebase';

/**
 * Staff and admin sign in with custom tokens only. Without a popup/redirect resolver Firebase never
 * loads Google's sign-in iframe (apis.google.com). Imported by staff and admin pages, never by guests.
 */
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
