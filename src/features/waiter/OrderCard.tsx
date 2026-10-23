import { BellRinging, CheckCircle, DotsThreeVertical, HandGrabbing, Receipt } from '@phosphor-icons/react';
import { m, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { formatEUR } from '@shared/money';
import type { OrderAction } from '@shared/order-lifecycle';
import { urgencyFor } from '@shared/urgency';
import type { Catalog, Order } from '@shared/types';
import { Badge, Button, cx } from '@/ui';
import { Age, OrderLines, urgencyClass } from '@/features/staff/parts';

export interface Primary {
  action: OrderAction;
  label: string;
  done: string;
}

/** The one next step for me on this order, or null when it is a colleague's. */
export function primaryFor(o: Order, myUid: string): Primary | null {
  const where = o.type === 'tab' ? 'Bon' : `Tisch ${o.tableLabel}`;
  if (o.claimedBy && o.claimedBy.uid !== myUid) return null;
  if (!o.claimedBy) return o.type === 'call' ? { action: 'claim', label: 'Ich gehe hin', done: `${where}: du gehst hin` } : { action: 'claim', label: 'Übernehmen', done: `${where} übernommen` };
  if (o.type === 'call') return { action: 'serve', label: 'Erledigt', done: `${where} erledigt` };
  if (o.type === 'tab') return { action: 'serve', label: 'Kassiert', done: 'Bon erledigt' };
  return { action: 'serve', label: 'Serviert', done: `${where} serviert` };
}

function statusText(o: Order, myUid: string): { text: string; tone: 'accent' | 'neutral' | 'ok' } {
  const mine = o.claimedBy?.uid === myUid;
  if (o.readyAt) return { text: mine ? 'Fertig – abholen' : 'Fertig an der Theke', tone: 'ok' };
  if (o.type === 'call') return o.claimedBy ? { text: mine ? 'Du gehst hin' : `${o.claimedBy.name} geht hin`, tone: 'neutral' } : { text: 'Ruft', tone: 'accent' };
  if (o.type === 'tab') return { text: o.sendToBar ? 'An der Theke' : 'Nur bei dir', tone: 'neutral' };
  if (!o.claimedBy) return { text: 'Neu', tone: 'accent' };
  if (!mine) return { text: `${o.claimedBy.name} bringt’s`, tone: 'neutral' };
  return { text: o.source === 'waiter' ? 'Von dir · an der Theke' : 'Übernommen', tone: 'neutral' };
}

interface Props {
  id: string;
  order: Order;
  catalog: Catalog;
  now: number;
  myUid: string;
  busy?: boolean;
  /** Read-only look for orders a colleague handles. */
  muted?: boolean;
  onAction: (id: string, p: Primary) => void;
  onMore: (id: string) => void;
}

const SWIPE = 110;

/**
 * Ticket card: the stub on the left carries table and waiting time and turns amber, then red.
 * Swipe right or tap the button for the next step; ⋮ opens hand-over and cancel.
 */
export function OrderCard({ id, order: o, catalog, now, myUid, busy, muted, onAction, onMore }: Props) {
  const x = useMotionValue(0);
  const reveal = useTransform(x, [0, SWIPE], [0, 1]);
  const primary = muted ? null : primaryFor(o, myUid);
  const status = statusText(o, myUid);
  const u = urgencyFor(o.createdAt, now);
  const isCall = o.type === 'call';
  const isTab = o.type === 'tab';

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (primary && !busy && info.offset.x > SWIPE) onAction(id, primary);
  };

  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: muted ? 0.66 : 1, y: 0 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="relative overflow-hidden rounded-[var(--radius-card)]"
    >
      {primary && (
        <m.div aria-hidden style={{ opacity: reveal }} className="absolute inset-0 flex items-center gap-2 bg-accent pl-6 text-lg font-bold text-accent-ink">
          <CheckCircle size={26} weight="fill" />
          {primary.label}
        </m.div>
      )}
      <m.article
        drag={primary ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.85 }}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
        style={{ x, touchAction: 'pan-y' }}
        aria-busy={busy || undefined}
        className="relative flex bg-surface-1 shadow-[var(--edge)]"
      >
        <div className={cx('flex w-[4.75rem] shrink-0 flex-col min-[400px]:w-[5.5rem] items-center justify-center gap-1.5 px-1 py-3 text-center', muted ? 'bg-surface-2 text-ink-2' : urgencyClass[u])}>
          {isTab ? (
            <>
              <Receipt size={26} weight="bold" aria-hidden />
              <span className="font-display text-[1.375rem] leading-none font-extrabold uppercase">Bon</span>
            </>
          ) : (
            <>
              {isCall && <BellRinging size={22} weight="fill" aria-hidden />}
              <span className="sr-only">Tisch</span>
              <span className={cx('num leading-[0.85] font-extrabold', (o.tableLabel ?? '').length > 3 ? 'text-[2rem]' : 'text-[2.875rem]')}>{o.tableLabel}</span>
            </>
          )}
          <Age since={o.createdAt} now={now} className="text-[1.25rem]" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 py-3 pr-2 pl-3.5">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={status.tone === 'accent' ? 'accent' : 'neutral'} className={status.tone === 'ok' ? '!bg-ok !text-[#03140a]' : undefined}>
                {status.text}
              </Badge>
              {isTab && o.note && <span className="truncate font-bold">{o.note}</span>}
              {!isTab && o.source === 'guest' && !isCall && <span className="text-[0.875rem] text-ink-3">vom Gast</span>}
            </div>
            {!muted && (
              <button
                type="button"
                onClick={() => onMore(id)}
                aria-label="Weitere Aktionen"
                className="-mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink"
              >
                <DotsThreeVertical size={22} weight="bold" />
              </button>
            )}
          </div>

          {isCall ? (
            <p className="text-[1.0625rem] font-bold">Bitte an den Tisch kommen</p>
          ) : (
            <OrderLines items={o.items} catalog={catalog} />
          )}

          {(primary || o.totalCents > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              {o.totalCents > 0 ? (
                <span className={cx('num leading-none font-extrabold', isTab ? 'text-[2rem]' : 'text-[1.625rem]')}>{formatEUR(o.totalCents)}</span>
              ) : (
                <span />
              )}
              {primary && (
                <Button
                  variant={primary.action === 'claim' ? 'primary' : 'secondary'}
                  busy={busy}
                  icon={primary.action === 'claim' ? <HandGrabbing size={20} weight="bold" /> : <CheckCircle size={20} weight="bold" />}
                  onClick={() => onAction(id, primary)}
                  className="ml-auto shrink-0"
                >
                  {primary.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </m.article>
    </m.li>
  );
}
