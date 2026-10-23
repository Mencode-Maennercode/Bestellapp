import { BellRinging, HandGrabbing } from '@phosphor-icons/react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatEUR } from '@shared/money';
import { summarize } from '@shared/pricing';
import type { Order } from '@shared/types';
import { Age } from '@/features/staff/parts';

interface Props {
  current: [string, Order] | null;
  more: number;
  now: number;
  busy: boolean;
  onClaim: (id: string) => void;
  onLater: (id: string) => void;
}

/** Full-screen alarm in the club's signal colour. Rings until taken or put aside. */
export function AlarmOverlay({ current, more, now, busy, onClaim, onLater }: Props) {
  const claimRef = useRef<HTMLButtonElement>(null);
  const id = current?.[0];
  useEffect(() => {
    if (id) requestAnimationFrame(() => claimRef.current?.focus());
  }, [id]);

  return createPortal(
    <AnimatePresence>
      {current && (
        <m.div
          key="alarm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alarm-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[55] flex flex-col bg-accent-2 text-accent-2-ink"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col gutter pt-[calc(var(--safe-top)+1.5rem)] pb-[max(1.25rem,var(--safe-bottom))]">
            <p id="alarm-title" className="flex items-center gap-2.5 text-xl font-extrabold">
              <BellRinging size={28} weight="fill" />
              {current[1].type === 'call' ? 'Tisch ruft dich' : 'Neue Bestellung'}
              <Age since={current[1].createdAt} now={now} className="ml-auto text-2xl" />
            </p>

            <m.div
              key={id}
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="relative my-auto grid place-items-center py-8"
            >
              <span aria-hidden className="absolute size-[min(70vw,18rem)] rounded-full border-[6px] border-current opacity-0 [animation:alarm-ring_1.6s_var(--ease-out-expo)_infinite]" />
              <span className="mb-3 font-display text-[1.75rem] leading-none font-extrabold uppercase">Tisch</span>
              <span className="num text-[clamp(8rem,52vw,13rem)] leading-[0.82] font-extrabold">{current[1].tableLabel}</span>
            </m.div>

            {current[1].type !== 'call' && (
              <div className="mb-6 rounded-[var(--radius-card)] bg-black/10 px-4 py-3.5">
                <p className="text-lg leading-snug font-bold text-pretty">{summarize(current[1].items)}</p>
                <p className="num mt-1 text-[1.75rem] leading-none font-extrabold">{formatEUR(current[1].totalCents)}</p>
              </div>
            )}

            <div className="grid gap-2.5">
              <button
                ref={claimRef}
                type="button"
                disabled={busy}
                onClick={() => onClaim(current[0])}
                className="flex min-h-16 items-center justify-center gap-3 rounded-[var(--radius-btn)] bg-[#0a0d0b] text-xl font-extrabold text-[#f6f8f6] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                <HandGrabbing size={26} weight="bold" />
                {current[1].type === 'call' ? 'Ich gehe hin' : 'Übernehmen'}
              </button>
              <button
                type="button"
                onClick={() => onLater(current[0])}
                className="min-h-14 rounded-[var(--radius-btn)] text-lg font-bold hover:bg-black/8"
              >
                Später – steht in der Liste{more > 0 ? ` · noch ${more}` : ''}
              </button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
