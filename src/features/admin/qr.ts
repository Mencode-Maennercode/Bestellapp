import QRCode from 'qrcode';
import { guestUrl } from '@/data/links';
import type { AdminEvent } from './context';

export const qrSvg = (url: string) =>
  QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0d0b', light: '#ffffff' } });

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Natural order: 7, 12, 56, 56a. */
export const byLabel = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true });

/**
 * Opens a print view with one QR code per table, six per A4 page. Plain HTML in its own window,
 * so the dark admin theme never ends up on paper. Returns false if the browser blocked the window.
 */
export async function printQrSheets(ev: AdminEvent): Promise<boolean> {
  const tables = Object.values(ev.tables).sort((a, b) => a.sort - b.sort || byLabel(a.label, b.label));
  const cards = await Promise.all(
    tables.map(async t => `
      <section class="card">
        <div class="band"></div>
        <p class="hint">Tisch</p>
        <p class="nr">${esc(t.label)}</p>
        <div class="qr">${await qrSvg(guestUrl(ev.pub.slug, t.guestCode))}</div>
        <p class="how">QR-Code scannen,<br>Getränke bestellen oder Köbes rufen</p>
        <p class="ev">${esc(ev.pub.name)}</p>
      </section>`),
  );
  const { primary, secondary } = ev.pub.accent;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>QR-Codes · ${esc(ev.pub.name)}</title>
<style>
  @page { size: A4; margin: 9mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #0a0d0b; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 88mm; gap: 6mm; }
  .card { break-inside: avoid; position: relative; overflow: hidden; border: 0.4mm solid #0a0d0b; border-radius: 5mm; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6mm 4mm 3mm; }
  .band { position: absolute; inset: 0 0 auto 0; height: 4mm; background: linear-gradient(90deg, ${primary} 50%, ${secondary} 50%); }
  .hint { margin: 0; font-size: 4mm; letter-spacing: 0.4mm; text-transform: uppercase; color: #444; }
  .nr { margin: 0; font: 800 24mm/0.95 "Arial Narrow", Impact, "Arial Black", sans-serif; }
  .qr { width: 44mm; height: 44mm; margin: 1.5mm 0; } .qr svg { width: 100%; height: 100%; }
  .how { margin: 0; font-size: 3.4mm; line-height: 1.25; }
  .ev { margin: 1.5mm 0 0; font-size: 3mm; color: #555; }
  @media screen { body { padding: 8mm; background: #eee; } .card { background: #fff; } }
</style></head><body><main class="grid">${cards.join('')}</main>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 350); });</script></body></html>`);
  w.document.close();
  return true;
}
