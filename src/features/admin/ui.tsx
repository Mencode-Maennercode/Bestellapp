import { useCallback, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { EventStatus } from '@shared/types';
import { ApiError } from '@/data/api';
import { Button, cx, Sheet, useToast } from '@/ui';

// Small building blocks shared by the admin screens.

export const inputClass =
  'min-h-12 w-full rounded-[var(--radius-btn)] bg-surface-3 px-4 text-ink shadow-[var(--edge)] outline-offset-2 disabled:opacity-50 placeholder:text-ink-3';

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-bold text-ink-2">{label}</label>
      {children(id)}
      {hint && <p className="text-[0.875rem] leading-snug text-ink-3 text-pretty">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, hint, className, ...rest }: { label: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint} className={className}>{id => <input id={id} className={inputClass} {...rest} />}</Field>;
}

export function TextArea({ label, hint, ...rest }: { label: string; hint?: ReactNode } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} hint={hint}>{id => <textarea id={id} className={cx(inputClass, 'min-h-28 py-3 leading-snug')} {...rest} />}</Field>;
}

export function SelectInput({ label, hint, children, ...rest }: { label: string; hint?: ReactNode; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <Field label={label} hint={hint}>{id => <select id={id} className={cx(inputClass, 'appearance-none')} {...rest}>{children}</select>}</Field>;
}

export function Card({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[var(--radius-card)] bg-surface-1 p-4 shadow-[var(--edge)] sm:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[1.625rem] leading-none font-extrabold uppercase">{title}</h2>}
            {subtitle && <p className="mt-1.5 text-[0.9375rem] text-ink-3 text-pretty">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'late' | 'ok' }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface-1 px-4 py-3 shadow-[var(--edge)]">
      <p className="text-[0.875rem] font-bold text-ink-3">{label}</p>
      <p className={cx('num mt-1 text-[2.5rem] leading-none font-extrabold', tone === 'warn' && 'text-warn', tone === 'late' && 'text-late', tone === 'ok' && 'text-ok')}>{value}</p>
      {hint && <p className="mt-1.5 text-[0.875rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface-3 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cx('min-h-11 rounded-full px-4 font-bold transition-colors', value === v ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Runs an async action with a busy flag; failures become a readable toast instead of a silent console error. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
      setBusy(true);
      try {
        await fn();
        if (ok) toast({ message: ok, tone: 'ok' });
        return true;
      } catch (e) {
        toast({ message: e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen. Verbindung und Anmeldung prüfen.', tone: 'error' });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

/** "Are you sure?" for actions that cannot be undone. */
export function ConfirmSheet({
  open, onClose, title, children, confirmLabel, onConfirm, busy, danger = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      level={2}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="space-y-3 pb-2 text-ink-2 text-pretty">{children}</div>
    </Sheet>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Milliseconds → value of an <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (v: string): number => new Date(v).getTime();

const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatWhen = (ms: number) => dateFmt.format(ms);

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const STATUS_LABEL: Record<EventStatus, string> = { draft: 'Entwurf', live: 'Live', closed: 'Beendet' };
export const statusTone = (s: EventStatus) => (s === 'live' ? 'accent' : s === 'draft' ? 'warn' : 'neutral') as 'accent' | 'warn' | 'neutral';
