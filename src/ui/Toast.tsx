import { AnimatePresence, m } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';

interface ToastInput {
  message: string;
  tone?: 'ok' | 'error' | 'info';
  /** Shows a "Rückgängig" button while the toast is visible (5 s by default). */
  undo?: () => void;
  ms?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = next.current++;
      setItems(list => [...list.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.ms ?? (t.undo ? 5000 : 3500));
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(var(--safe-top)+0.75rem)]"
        >
          <AnimatePresence initial={false}>
            {items.map(t => (
              <m.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-[var(--radius-btn)] bg-surface-3 py-2 pr-2 pl-3 font-semibold shadow-[var(--edge),0_12px_32px_rgb(0_0_0/0.5)]"
              >
                <span
                  aria-hidden
                  className={cx('size-2.5 shrink-0 rounded-full', t.tone === 'error' ? 'bg-late' : t.tone === 'info' ? 'bg-accent-2' : 'bg-ok')}
                />
                <span className="flex-1 py-1.5">{t.message}</span>
                {t.undo && (
                  <button
                    type="button"
                    className="min-h-11 rounded-[10px] px-3 font-bold text-accent-2 hover:bg-surface-2"
                    onClick={() => {
                      t.undo?.();
                      dismiss(t.id);
                    }}
                  >
                    Rückgängig
                  </button>
                )}
              </m.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
