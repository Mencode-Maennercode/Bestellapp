// Sets the admin PIN (stored only as scrypt hash under secrets/adminPin).
//
//   node scripts/set-admin-pin.mjs              → production (karneval-acfff), needs Google credentials
//   node scripts/set-admin-pin.mjs --emulator   → local emulator (npm run emu)
//
// The PIN is read from the terminal, never from the command line (keeps it out of shell history).
import { createRequire } from 'node:module';
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const emulator = process.argv.includes('--emulator');
if (emulator) process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pin = (await rl.question('Neue Admin-PIN (4–8 Ziffern): ')).trim();
const repeat = (await rl.question('PIN wiederholen: ')).trim();
rl.close();

if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN muss aus 4–8 Ziffern bestehen.');
if (pin !== repeat) throw new Error('Die PINs stimmen nicht überein.');
if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
  throw new Error('Bitte keine einfache PIN wie 1111 oder 1234 verwenden.');
}

initializeApp(
  emulator
    ? { projectId: 'demo-karneval', databaseURL: 'http://127.0.0.1:9000?ns=demo-karneval' }
    : { credential: applicationDefault(), databaseURL: 'https://karneval-acfff-default-rtdb.europe-west1.firebasedatabase.app' },
);

const salt = randomBytes(16).toString('hex');
await getDatabase().ref('secrets/adminPin').set({ salt, hash: scryptSync(pin, salt, 32).toString('hex') });
console.log('Admin-PIN gespeichert (nur als Hash).');
process.exit(0);
