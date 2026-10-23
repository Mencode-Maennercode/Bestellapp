import { ArrowLeft, Receipt } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { Catalog } from '@shared/types';
import { ApiError, api, newRequestId } from '@/data/api';
import { CartBar, CartSheet } from '@/features/menu/Cart';
import { Menu } from '@/features/menu/Menu';
import { menuStrings } from '@/features/menu/strings';
import { toLines, useCart } from '@/features/menu/useCart';
import { Sash, Switch } from '@/features/staff/parts';
import { useToast } from '@/ui';

export type OrderTarget = { kind: 'table'; tableId: string; label: string } | { kind: 'tab' };

interface Props {
  eventId: string;
  catalog: Catalog;
  target: OrderTarget;
  onClose: () => void;
}

const HEADER = 'calc(var(--safe-top) + 4.25rem)';
const s = { ...menuStrings.hochdeutsch, cartTitle: 'Bestellung prüfen' };

/** The same menu guests use, for a table or a Schnellbon without table. */
export function WaiterOrder({ eventId, catalog, target, onClose }: Props) {
  const toast = useToast();
  const isTab = target.kind === 'tab';
  const cart = useCart(catalog, `wcart:${eventId}:${isTab ? 'tab' : target.tableId}`);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [toBar, setToBar] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  // A changed order is a new request; an unchanged retry keeps its id and is never booked twice.
  useEffect(() => {
    requestId.current = null;
    setError(null);
  }, [cart.cart, note, toBar]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (open && !Object.keys(cart.cart).length) setOpen(false);
  }, [cart.cart, open]);

  const title = isTab ? 'Schnellbon' : `Tisch ${target.label}`;

  const submit = async () => {
    setSending(true);
    setError(null);
    requestId.current ??= newRequestId();
    try {
      await api.waiterOrder({
        eventId,
        type: isTab ? 'tab' : 'order',
        ...(isTab ? { note: note.trim() || undefined, sendToBar: toBar } : { tableId: target.tableId }),
        lines: toLines(cart.cart),
        requestId: requestId.current,
      });
      cart.clear();
      toast({ message: isTab ? (toBar ? 'Bon gespeichert und an die Theke' : 'Bon gespeichert') : `Tisch ${target.label}: an die Theke`, tone: 'ok' });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/94 backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg" style={{ height: HEADER }}>
        <div className="pt-[var(--safe-top)]">
          <Sash />
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 gutter">
            <button
              type="button"
              onClick={onClose}
              className="-ml-2 flex min-h-12 items-center gap-2 rounded-[12px] px-2 font-bold text-ink-2 hover:bg-surface-1 hover:text-ink"
            >
              <ArrowLeft size={22} weight="bold" />
              Liste
            </button>
            <h1 className="ml-auto flex items-center gap-2 font-display text-[1.875rem] leading-none font-extrabold uppercase">
              {isTab && <Receipt size={24} weight="bold" aria-hidden />}
              {title}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl gutter pb-32">
        <Menu catalog={catalog} cart={cart} s={s} offset={HEADER} id="kellner-karte" />
      </main>

      <CartBar cart={cart} s={s} onOpen={() => setOpen(true)} />
      <CartSheet
        open={open}
        onClose={() => setOpen(false)}
        cart={cart}
        catalog={catalog}
        s={s}
        subtitle={title}
        error={error}
        busy={sending}
        hint={isTab ? 'Nur du siehst diesen Bon. Kein Alarm bei anderen.' : 'Geht an die Theke, der Tisch sieht den Status.'}
        submitLabel={sending ? 'Wird gesendet …' : isTab ? 'Bon speichern' : 'An die Theke senden'}
        onSubmit={submit}
        extra={
          isTab && (
            <div className="flex flex-col gap-2.5 pt-1">
              <label className="block">
                <span className="mb-1.5 block font-bold">
                  Merker <span className="font-normal text-ink-3">optional</span>
                </span>
                <input
                  value={note}
                  maxLength={40}
                  onChange={e => setNote(e.target.value)}
                  placeholder="z. B. Fenster, rote Jacke"
                  enterKeyHint="done"
                  className="min-h-14 w-full rounded-[var(--radius-btn)] bg-surface-3 px-4 text-lg shadow-[var(--edge)] outline-none focus-visible:outline-2 focus-visible:outline-accent-2"
                />
              </label>
              <Switch
                checked={toBar}
                onChange={setToBar}
                label="An die Theke senden"
                hint={toBar ? 'Die Theke macht die Getränke fertig.' : 'Du holst selbst, die Theke sieht den Bon nicht.'}
              />
            </div>
          )
        }
      />
    </>
  );
}
