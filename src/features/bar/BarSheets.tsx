import { Copy, ShareNetwork } from '@phosphor-icons/react';
import { ref, set } from 'firebase/database';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Catalog } from '@shared/types';
import { db } from '@/data/firebase';
import { Button, cx, ProductImage, Sheet, useToast } from '@/ui';

/** "Ausverkauft" without PIN: staff may only flip this one flag (database rules enforce it). */
export function SoldOutSheet({ open, onClose, eventId, catalog }: { open: boolean; onClose: () => void; eventId: string; catalog: Catalog }) {
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const categories = Object.entries(catalog.categories).filter(([, c]) => c.active).sort((a, b) => a[1].sort - b[1].sort);
  const soldOutCount = Object.values(catalog.products).filter(p => p.active && p.soldOut).length;

  const toggle = async (id: string, soldOut: boolean) => {
    setPending(p => ({ ...p, [id]: true }));
    try {
      await set(ref(db, `events/${eventId}/catalog/products/${id}/soldOut`), soldOut);
      toast({ message: `${catalog.products[id].name}: ${soldOut ? 'ausverkauft' : 'wieder da'}`, tone: soldOut ? 'info' : 'ok' });
    } catch {
      toast({ message: 'Konnte nicht gespeichert werden. Verbindung prüfen.', tone: 'error' });
    } finally {
      setPending(({ [id]: _, ...rest }) => rest);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ausverkauft" subtitle={soldOutCount ? `${soldOutCount} ausverkauft · Gäste sehen es sofort` : 'Gäste sehen es sofort auf der Karte'}>
      <div className="flex flex-col gap-6 pb-2">
        {categories.map(([cid, c]) => {
          const products = Object.entries(catalog.products)
            .filter(([, p]) => p.active && p.categoryId === cid && !p.glassFor)
            .sort((a, b) => a[1].sort - b[1].sort);
          if (!products.length) return null;
          return (
            <section key={cid}>
              <h3 className="mb-2 font-display text-[1.375rem] leading-none font-extrabold text-ink-2 uppercase">{c.name}</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {products.map(([id, p]) => (
                  <li key={id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.soldOut}
                      disabled={pending[id]}
                      onClick={() => toggle(id, !p.soldOut)}
                      className={cx(
                        'flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-btn)] py-1.5 pr-3 pl-1.5 text-left transition-colors',
                        p.soldOut ? 'bg-late/14' : 'bg-surface-3 shadow-[var(--edge)]',
                      )}
                    >
                      <ProductImage image={p.image} categoryId={p.categoryId} dim={p.soldOut} sizes="44px" className="size-11 shrink-0 rounded-[10px]" />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={cx('block font-bold', p.soldOut && 'text-ink-2 line-through')}>{p.name}</span>
                        {p.size && <span className="block text-[0.875rem] text-ink-3">{p.size}</span>}
                      </span>
                      <span className={cx('shrink-0 text-[0.875rem] font-bold', p.soldOut ? 'text-[#ffb0aa]' : 'text-ink-3')}>{p.soldOut ? 'Aus' : 'Da'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

const base = import.meta.env.BASE_URL;

/** Kellner link as QR for the next waiter who arrives at the bar, plus copy/share. */
export function LinkSheet({ open, onClose, token, eventName }: { open: boolean; onClose: () => void; token: string; eventName: string }) {
  const toast = useToast();
  const [which, setWhich] = useState<'kellner' | 'theke'>('kellner');
  const [svg, setSvg] = useState('');
  const url = `${location.origin}${base}${which}/#${token}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0d0b', light: '#ffffff' } }).then(setSvg, () => setSvg(''));
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link kopiert', tone: 'ok' });
    } catch {
      toast({ message: 'Kopieren nicht möglich', tone: 'error' });
    }
  };
  const share = () => navigator.share?.({ title: `${which === 'kellner' ? 'Kellner' : 'Theke'} · ${eventName}`, url }).catch(() => {});

  return (
    <Sheet open={open} onClose={onClose} title="Personal-Link" subtitle="Gilt nur für diese Veranstaltung">
      <div className="flex flex-col items-center gap-4 pb-2">
        <div role="tablist" aria-label="Link für" className="grid w-full grid-cols-2 gap-1 rounded-full bg-surface-3 p-1">
          {(['kellner', 'theke'] as const).map(k => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={which === k}
              onClick={() => setWhich(k)}
              className={cx('min-h-11 rounded-full font-bold transition-colors', which === k ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink')}
            >
              {k === 'kellner' ? 'Kellner' : 'Theke'}
            </button>
          ))}
        </div>
        <div
          className="aspect-square w-full max-w-[17rem] rounded-[var(--radius-card)] bg-white p-3 [&_svg]:size-full"
          role="img"
          aria-label={`QR-Code für den ${which === 'kellner' ? 'Kellner' : 'Theken'}-Zugang`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="max-w-[34ch] text-center text-ink-2 text-pretty">
          {which === 'kellner' ? 'Mit der Handykamera scannen, Namen eingeben, fertig.' : 'Für ein weiteres Theken-Gerät.'} Nicht an Gäste weitergeben.
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" icon={<Copy size={20} weight="bold" />} onClick={copy}>Kopieren</Button>
          {'share' in navigator ? (
            <Button variant="secondary" icon={<ShareNetwork size={20} weight="bold" />} onClick={share}>Teilen</Button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </Sheet>
  );
}
