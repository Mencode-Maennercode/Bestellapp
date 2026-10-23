import { CalendarBlank, LinkBreak, Megaphone, Pause, Prohibit, WifiSlash, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CODE_PATTERN } from '@shared/codes';
import { EVENT_GRACE_MS, eventGate } from '@shared/event-window';
import type { Catalog, EventPublic, SystemState, TableStatusEntry } from '@shared/types';
import { ApiError, api, newRequestId } from '@/data/api';
import { useLive, useNow } from '@/data/live';
import { hashParam } from '@/data/session';
import { CartBar, CartSheet } from '@/features/menu/Cart';
import { toLines, useCart } from '@/features/menu/useCart';
import { Menu } from '@/features/menu/Menu';
import { menuStrings } from '@/features/menu/strings';
import { applyAccent, Button, Notice, Skeleton, useToast } from '@/ui';
import { CallButton } from './CallButton';
import { FeedbackSheet } from './FeedbackSheet';
import { Footer } from './Footer';
import { OrderTracker } from './OrderTracker';
import { guestStrings, type GuestStrings } from './strings';

const CALL_COOLDOWN_MS = 5 * 60 * 1000;
const CODE_KEY = 'guestCode';
const bokeh = `${import.meta.env.BASE_URL}img/bokeh-dunkel.webp`;

/** Code from the QR link; the installed home-screen app falls back to the last scanned code. */
function resolveCode(): string | null {
  const fromHash = hashParam();
  try {
    if (CODE_PATTERN.test(fromHash)) {
      localStorage.setItem(CODE_KEY, fromHash);
      return fromHash;
    }
    const stored = localStorage.getItem(CODE_KEY);
    if (!fromHash && stored && CODE_PATTERN.test(stored)) {
      history.replaceState(null, '', `#${stored}`);
      return stored;
    }
  } catch {
    /* storage blocked */
  }
  return CODE_PATTERN.test(fromHash) ? fromHash : null;
}

const timeFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function GuestApp() {
  const [code] = useState(resolveCode);
  const link = useLive<{ eventId: string; tableId: string }>(code ? `guestCodes/${code}` : null);
  const ids = link.status === 'ready' ? link.value : null;
  const ev = ids ? `events/${ids.eventId}` : null;
  const pub = useLive<EventPublic>(ev && `${ev}/public`);
  const catalog = useLive<Catalog>(ev && `${ev}/catalog`);
  const system = useLive<SystemState>(ev && `${ev}/system`);
  const label = useLive<string>(ev && ids && `${ev}/tables/${ids.tableId}/label`);
  const status = useLive<Record<string, TableStatusEntry>>(ev && code && `${ev}/tableStatus/${code}`);
  const now = useNow(1000);

  const p = pub.status === 'ready' ? pub.value : null;
  useEffect(() => applyAccent(p?.accent), [p?.accent]);
  useEffect(() => {
    if (p) document.documentElement.lang = 'de';
  }, [p]);

  const t = guestStrings[p?.language ?? 'koelsch'];
  const failed = [link, pub, catalog, system, label, status].some(l => l.status === 'error');

  if (!code) return <Notice icon={<LinkBreak size={44} />} title={t.invalidTitle}>{t.invalidText}</Notice>;
  if (failed)
    return (
      <Notice icon={<WifiSlash size={44} />} title={t.offlineTitle} action={<Button onClick={() => location.reload()}>{t.reload}</Button>}>
        {t.offlineText}
      </Notice>
    );
  if (link.status === 'ready' && !link.value) return <Notice icon={<LinkBreak size={44} />} title={t.invalidTitle}>{t.invalidText}</Notice>;
  if (!p || catalog.status !== 'ready' || system.status !== 'ready' || label.status !== 'ready' || status.status !== 'ready') return <Loading />;

  const gate = eventGate(p, now);
  if (gate === 'ended') return <Notice icon={<CalendarBlank size={44} />} title={t.endedTitle}>{t.endedText}</Notice>;
  if (gate === 'notLive') return <Notice icon={<CalendarBlank size={44} />} title={t.notLiveTitle}>{t.notLiveText}</Notice>;
  if (gate === 'notStarted')
    return <Notice icon={<CalendarBlank size={44} />} title={t.notStartedTitle}>{t.notStartedText(timeFmt.format(p.startsAt - EVENT_GRACE_MS))}</Notice>;
  if (!catalog.value) return <Loading />;

  return (
    <Guest
      t={t}
      code={code}
      eventId={ids!.eventId}
      pub={p}
      catalog={catalog.value}
      system={system.value ?? { shutdown: false, ordersPaused: false }}
      tableLabel={label.value ?? '?'}
      status={status.value ?? {}}
      now={now}
    />
  );
}

interface GuestProps {
  t: GuestStrings;
  code: string;
  eventId: string;
  pub: EventPublic;
  catalog: Catalog;
  system: SystemState;
  tableLabel: string;
  status: Record<string, TableStatusEntry>;
  now: number;
}

function Guest({ t, code, eventId, pub, catalog, system, tableLabel, status, now }: GuestProps) {
  const s = menuStrings[pub.language];
  const toast = useToast();
  const cart = useCart(catalog, `cart:${code}`);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [localCallAt, setLocalCallAt] = useState(0);
  const requestId = useRef<string | null>(null);

  // A changed cart is a new order; an unchanged retry reuses its id so it is never booked twice.
  useEffect(() => {
    requestId.current = null;
    setError(null);
  }, [cart.cart]);

  useEffect(() => {
    if (cartOpen && cart.count === 0 && cart.total === 0 && !Object.keys(cart.cart).length) setCartOpen(false);
  }, [cart, cartOpen]);

  const entries = useMemo(() => {
    const keep = pub.archiveMinutes * 60 * 1000;
    return Object.entries(status)
      .filter(([, e]) => !e.doneAt || now - e.doneAt < keep)
      .sort((a, b) => b[1].createdAt - a[1].createdAt);
  }, [status, now, pub.archiveMinutes]);

  const lastCall = Math.max(localCallAt, ...Object.values(status).filter(e => e.type === 'call').map(e => e.createdAt));
  const cooldownUntil = lastCall > 0 ? lastCall + CALL_COOLDOWN_MS : 0;

  const submit = async () => {
    setSending(true);
    setError(null);
    requestId.current ??= newRequestId();
    try {
      await api.guestOrder(code, toLines(cart.cart), requestId.current);
      requestId.current = null;
      cart.clear();
      setCartOpen(false);
      toast({ message: t.orderSent, tone: 'ok' });
      requestAnimationFrame(() => document.getElementById('h-status')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const callWaiter = async () => {
    setCalling(true);
    try {
      await api.callWaiter(code, newRequestId());
      setLocalCallAt(Date.now());
      toast({ message: t.callSent, tone: 'ok' });
    } catch (e) {
      const reason = e instanceof ApiError ? e.reason : '';
      if (reason === 'cooldown') setLocalCallAt(Date.now());
      toast({ message: reason === 'cooldown' ? t.callBusy : (e as Error).message, tone: reason === 'cooldown' ? 'info' : 'error' });
    } finally {
      setCalling(false);
    }
  };

  const ordering = !system.shutdown && !system.ordersPaused;

  return (
    <>
      <header className="relative isolate overflow-hidden">
        <img src={bokeh} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover object-top opacity-50 [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
        <div aria-hidden className="flex h-1">
          <span className="flex-1 bg-accent" />
          <span className="flex-1 bg-accent-2" />
        </div>
        <div className="mx-auto max-w-5xl gutter pt-[calc(var(--safe-top)+1.25rem)] pb-6">
          <p className="max-w-[28ch] text-[0.9375rem] font-bold text-ink-2">{pub.name}</p>
          <h1 className="mt-3 flex items-end gap-3 font-display leading-[0.8] font-extrabold uppercase">
            <span className="pb-[0.32em] text-[clamp(1.75rem,7vw,2.5rem)] text-ink-2">{t.table}</span>
            <motion.span
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="text-[clamp(7rem,38vw,11rem)] tracking-[-0.01em]"
            >
              {tableLabel}
            </motion.span>
          </h1>
          <div className="mt-6 grid max-w-xl grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
            <Button
              size="lg"
              disabled={!ordering}
              onClick={() => document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.order}
            </Button>
            <CallButton
              label={t.call}
              confirmLabel={t.callConfirm}
              cooldownUntil={cooldownUntil}
              cooldownMs={CALL_COOLDOWN_MS}
              now={now}
              busy={calling}
              onCall={callWaiter}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl gutter">
        <Banners t={t} system={system} />
        <OrderTracker entries={entries} t={t} />
        {!system.shutdown && <Menu catalog={catalog} cart={cart} s={s} disabled={!ordering} />}
        <Footer t={t} />
      </main>

      {ordering && <CartBar cart={cart} s={s} onOpen={() => setCartOpen(true)} />}
      <CartSheet
        open={cartOpen && ordering}
        onClose={() => setCartOpen(false)}
        cart={cart}
        catalog={catalog}
        s={s}
        subtitle={`${t.table} ${tableLabel}`}
        hint={s.payHint}
        error={error}
        busy={sending}
        submitLabel={sending ? t.sending : t.orderNow}
        onSubmit={submit}
      />
      <FeedbackSheet t={t} eventId={eventId} />
    </>
  );
}

const DISMISS_KEY = 'broadcastSeen';

function Banners({ t, system }: { t: GuestStrings; system: SystemState }) {
  const b = system.broadcast;
  const [seen, setSeen] = useState(() => {
    try {
      return Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch {
      return 0;
    }
  });
  const showBroadcast = b && b.target !== 'staff' && b.createdAt > seen;

  const items = [
    system.shutdown && { key: 'shutdown', icon: <Prohibit size={26} weight="bold" />, title: t.shutdownTitle, text: t.shutdownText, tone: 'late' as const },
    !system.shutdown && system.ordersPaused && { key: 'paused', icon: <Pause size={26} weight="fill" />, title: t.pausedTitle, text: t.pausedText, tone: 'warn' as const },
  ].filter(Boolean) as { key: string; icon: ReactNode; title: string; text: string; tone: 'late' | 'warn' }[];

  return (
    <div className="flex flex-col gap-2.5 empty:hidden">
      {items.map(i => (
        <div key={i.key} role="alert" className="flex gap-3.5 rounded-[var(--radius-card)] bg-surface-1 p-4 shadow-[var(--edge)]">
          <span className={i.tone === 'late' ? 'text-late' : 'text-warn'}>{i.icon}</span>
          <div>
            <p className="text-lg font-bold">{i.title}</p>
            <p className="mt-0.5 text-ink-2">{i.text}</p>
          </div>
        </div>
      ))}
      <AnimatePresence>
        {showBroadcast && (
          <motion.div
            key={b.createdAt}
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: -10 }}
            className="flex gap-3.5 rounded-[var(--radius-card)] bg-accent-2 py-3.5 pr-2 pl-4 text-accent-2-ink"
          >
            <Megaphone size={26} weight="fill" className="mt-0.5 shrink-0" />
            <p className="flex-1 py-0.5 text-lg font-bold text-pretty">{b.message}</p>
            <button
              type="button"
              aria-label={t.broadcastClose}
              onClick={() => {
                setSeen(b.createdAt);
                try {
                  localStorage.setItem(DISMISS_KEY, String(b.createdAt));
                } catch {
                  /* ignore */
                }
              }}
              className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/10"
            >
              <X size={20} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-5xl gutter pt-[calc(var(--safe-top)+1.5rem)]" aria-busy="true" aria-label="Laden">
      <Skeleton className="h-4 w-40 rounded-full" />
      <Skeleton className="mt-5 h-36 w-56" />
      <div className="mt-6 grid max-w-xl grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
      </div>
    </div>
  );
}
