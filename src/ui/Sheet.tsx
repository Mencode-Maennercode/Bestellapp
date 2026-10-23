import { X } from '@phosphor-icons/react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Stacked sheets (e.g. glasses over a bottle list) sit above their parent. */
  level?: 1 | 2;
}

// Open sheets, topmost last. Esc and Tab only act on the topmost one.
const stack: symbol[] = [];
function track(id: symbol, open: boolean) {
  if (open) stack.push(id);
  else stack.splice(stack.indexOf(id), 1);
  document.documentElement.style.overflow = stack.length ? 'hidden' : '';
}

const FOCUSABLE = 'button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]';

/** Bottom sheet: drag the handle down, tap outside or press Esc to close. Focus stays inside. */
export function Sheet({ open, onClose, title, subtitle, children, footer, level = 1 }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = Symbol('sheet');
    track(id, true);
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => panel.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      const el = panel.current;
      if (!el || stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      track(id, false);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cx('fixed inset-0 flex items-end justify-center', level === 2 ? 'z-50' : 'z-40')}>
          <motion.div
            className="absolute inset-0 bg-[#020302]/72"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative flex max-h-[min(90dvh,860px)] w-full max-w-xl flex-col rounded-t-[22px] bg-surface-2 outline-none sm:mb-6 sm:rounded-[22px]"
            style={{ boxShadow: 'var(--edge), 0 -18px 48px rgb(0 0 0 / 0.55)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="relative flex shrink-0 cursor-grab touch-none items-start gap-3 px-5 pt-6 pb-3 active:cursor-grabbing"
              onPointerDown={e => drag.start(e)}
            >
              <span aria-hidden className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-3/45" />
              <div className="min-w-0 flex-1 pt-1">
                <h2 id={titleId} className="font-display text-[1.875rem] leading-[1.02] font-extrabold uppercase text-balance">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                onPointerDown={e => e.stopPropagation()}
                className="-mt-1 -mr-2 grid size-12 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink"
                aria-label="Schließen"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(1rem,var(--safe-bottom))]">{footer}</div>
            ) : (
              <div className="h-[var(--safe-bottom)] shrink-0" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
