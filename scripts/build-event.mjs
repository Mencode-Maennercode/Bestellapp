// Builds the guest / waiter / bar site of ONE event for its own folder on the web host.
//
//   npm run build:event -- Hochzeit-Meier <eventId>
//
// Result: dist-events/Hochzeit-Meier/  → upload as  www.praesenzwert.de/Hochzeit-Meier/
// The site only works for that event (codes and links of any other event are refused), and deleting
// the folder later kills the event's addresses on the web host. The admin is not part of it: it stays
// at /Buchungssystem/admin/.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const [slug, eventId] = process.argv.slice(2);
if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(slug ?? '') || !/^[A-Za-z0-9_-]{1,40}$/.test(eventId ?? '')) {
  console.error('Usage: npm run build:event -- <folder-name> <eventId>\n  folder-name: 3–40 letters, digits, "-"   eventId: shown in the admin under "Veranstaltung veröffentlichen"');
  process.exit(1);
}

const out = `dist-events/${slug}`;
rmSync(out, { recursive: true, force: true });
const res = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, EVENT_BUILD: '1', BUILD_BASE: `/${slug}/`, BUILD_OUT: out, VITE_EVENT_ID: eventId },
});
if (res.status) process.exit(res.status);
console.log(`\nFertig: ${out}/\nHochladen nach:  www.praesenzwert.de/${slug}/   (Ordner komplett ersetzen)\nNach der Veranstaltung den Ordner löschen – dann sind alle Adressen tot.`);
