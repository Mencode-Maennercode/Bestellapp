import { motion } from 'motion/react';
import { formatEUR } from '@shared/money';
import type { TableStatusEntry } from '@shared/types';
import { cx } from '@/ui';
import type { GuestStrings } from './strings';

interface Step {
  label: string;
  state: 'done' | 'now' | 'todo';
}

function stepsFor(e: TableStatusEntry, t: GuestStrings): Step[] {
  const name = e.waiterName ?? '';
  const call = e.type === 'call';
  const second = name ? (call ? t.statusComes(name) : t.statusBrings(name)) : e.status === 'ready' ? t.statusReady : t.statusWorking;
  const third = call ? t.statusDone : t.statusServed;
  const level = e.status === 'served' ? 3 : e.status === 'accepted' || e.status === 'ready' ? 2 : 1;
  return [
    { label: call ? t.statusCalled : t.statusSent, state: level > 1 ? 'done' : 'now' },
    { label: second, state: level > 2 ? 'done' : level === 2 ? 'now' : 'todo' },
    { label: third, state: level === 3 ? 'done' : 'todo' },
  ];
}

const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Live status of this table's orders: Gesendet → Anna bringt's → Serviert. */
export function OrderTracker({ entries, t }: { entries: [string, TableStatusEntry][]; t: GuestStrings }) {
  if (!entries.length) return null;
  return (
    <section aria-labelledby="h-status" className="pt-6">
      <h2 id="h-status" className="mb-3 font-display text-[2rem] leading-none font-extrabold uppercase">{t.yourOrders}</h2>
      <ol className="flex flex-col gap-2.5" aria-live="polite">
        {entries.map(([id, e]) => {
          const cancelled = e.status === 'cancelled';
          const steps = stepsFor(e, t);
          return (
            <motion.li
              key={id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: cancelled || e.status === 'served' ? 0.62 : 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="rounded-[var(--radius-card)] bg-surface-1 px-4 pt-3.5 pb-4 shadow-[var(--edge)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 font-bold text-pretty">{e.type === 'call' ? t.call : e.summary}</p>
                <p className="shrink-0 text-[0.9375rem] text-ink-3">
                  {e.totalCents > 0 && <span className="num mr-2 text-lg font-bold text-ink-2">{formatEUR(e.totalCents)}</span>}
                  {timeFmt.format(e.createdAt)}
                </p>
              </div>
              {cancelled ? (
                <p className="mt-2 font-bold text-late">{t.cancelled}</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {steps.map((st, i) => (
                    <div key={i} className="min-w-0">
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <motion.div
                          className={cx('absolute inset-y-0 left-0 rounded-full', st.state === 'todo' ? 'bg-transparent' : 'bg-accent')}
                          initial={false}
                          animate={{ width: st.state === 'todo' ? '0%' : '100%' }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          style={st.state === 'now' ? { animation: 'pulse-late 1.8s ease-in-out infinite' } : undefined}
                        />
                      </div>
                      <p className={cx('mt-1.5 text-[0.875rem] leading-tight font-semibold text-pretty', st.state === 'todo' ? 'text-ink-3' : st.state === 'now' ? 'text-ink' : 'text-ink-2')}>
                        {st.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
