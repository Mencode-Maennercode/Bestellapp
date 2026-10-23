import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const PROJECT = 'demo-karneval';
export const DB_URL = `http://127.0.0.1:9000?ns=${PROJECT}`;
export const ADMIN_PIN = '482913';

export async function rulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT,
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync('database.rules.json', 'utf8') },
  });
}

export function pinRecord(pin: string) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(pin, salt, 32).toString('hex') };
}

let appCount = 0;

/** A separate client (own auth session) talking to the emulators. */
export class Client {
  app: FirebaseApp;
  db: Database;
  fns: Functions;

  constructor() {
    this.app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', databaseURL: DB_URL }, `client-${appCount++}`);
    const auth = getAuth(this.app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    this.db = getDatabase(this.app);
    connectDatabaseEmulator(this.db, '127.0.0.1', 9000);
    this.fns = getFunctions(this.app, 'europe-west1');
    connectFunctionsEmulator(this.fns, '127.0.0.1', 5001);
  }

  call<T = unknown>(name: string, data: unknown): Promise<T> {
    return httpsCallable(this.fns, name)(data).then(r => r.data as T);
  }

  /** Calls and returns the error reason ("cooldown", "wrongPin", …) or "ok". */
  async reason(name: string, data: unknown): Promise<string> {
    try {
      await this.call(name, data);
      return 'ok';
    } catch (e) {
      const err = e as { details?: { reason?: string }; message?: string };
      return err.details?.reason ?? err.message ?? 'error';
    }
  }

  async signIn(customToken: string) {
    await signInWithCustomToken(getAuth(this.app), customToken);
    return getAuth(this.app).currentUser!.uid;
  }

  close() {
    return deleteApp(this.app);
  }
}

export const requestId = () => crypto.randomUUID();
