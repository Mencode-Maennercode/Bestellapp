import { Star } from '@phosphor-icons/react';
import { push, ref, set } from 'firebase/database';
import { useEffect, useState, type FormEvent } from 'react';
import type { Feedback } from '@shared/types';
import { db } from '@/data/firebase';
import { useNow } from '@/data/live';
import { Button, cx, Sheet } from '@/ui';
import type { GuestStrings } from './strings';

const HOUR = 60 * 60 * 1000;
const KEY = 'pwFeedback';

interface Memory {
  firstOpen: number;
  shown: number;
  lastShown: number;
  done?: boolean;
}

function read(): Memory {
  const fresh = { firstOpen: Date.now(), shown: 0, lastShown: 0 };
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) localStorage.setItem(KEY, JSON.stringify(fresh));
    return { ...fresh, ...JSON.parse(stored ?? '{}') };
  } catch {
    return fresh;
  }
}
function write(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage blocked: the popup may show again, harmless */
  }
}

/** Same rhythm as before: first ask 1 h after the first visit, a second time 1.5 h later, never more. */
function useFeedbackTiming(now: number) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const m = read();
    if (m.done || open) return;
    const due = (m.shown === 0 && now - m.firstOpen >= HOUR) || (m.shown === 1 && now - m.lastShown >= 1.5 * HOUR);
    if (due) {
      write({ ...m, shown: m.shown + 1, lastShown: now });
      setOpen(true);
    }
  }, [now, open]);
  return [open, setOpen] as const;
}

const field =
  'w-full rounded-[12px] bg-surface-3 px-4 py-3 shadow-[var(--edge)] outline-none focus-visible:outline-2 focus-visible:outline-accent-2';

/** PräsenzWert rating with optional contact. Guests can only create entries, never read them. */
export function FeedbackSheet({ t, eventId }: { t: GuestStrings; eventId: string }) {
  const now = useNow(60_000);
  const [open, setOpen] = useFeedbackTiming(now);
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setState('busy');
    const entry: Feedback = { rating, eventId, createdAt: Date.now() };
    if (form.name.trim()) entry.name = form.name.trim().slice(0, 60);
    if (form.email.trim()) entry.email = form.email.trim().slice(0, 120);
    if (form.message.trim()) entry.message = form.message.trim().slice(0, 600);
    try {
      await set(push(ref(db, 'feedback')), entry);
      write({ ...read(), done: true });
      setState('done');
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setState('error');
    }
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={t.feedbackTitle}>
      {state === 'done' ? (
        <p className="pb-6 text-xl font-bold text-ok">{t.feedbackThanks}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
          <div role="radiogroup" aria-label={t.feedbackTitle} className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t.stars(n)}
                onClick={() => setRating(n)}
                className={cx('grid size-14 place-items-center rounded-full transition-transform active:scale-90', n <= rating ? 'text-accent-2' : 'text-ink-3')}
              >
                <Star size={34} weight={n <= rating ? 'fill' : 'regular'} />
              </button>
            ))}
          </div>
          <p className="text-ink-2">{t.feedbackText}</p>
          {(['name', 'email', 'message'] as const).map(k => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className="text-[0.9375rem] font-bold text-ink-2">
                {k === 'name' ? t.feedbackName : k === 'email' ? t.feedbackEmail : t.feedbackMessage}{' '}
                <span className="font-normal text-ink-3">({t.optional})</span>
              </span>
              {k === 'message' ? (
                <textarea rows={3} maxLength={600} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className={cx(field, 'resize-none')} />
              ) : (
                <input
                  type={k === 'email' ? 'email' : 'text'}
                  autoComplete={k === 'email' ? 'email' : 'name'}
                  maxLength={k === 'email' ? 120 : 60}
                  value={form[k]}
                  onChange={e => setForm({ ...form, [k]: e.target.value })}
                  className={field}
                />
              )}
            </label>
          ))}
          {state === 'error' && <p role="alert" className="font-semibold text-late">Senden fehlgeschlagen. Bitte später erneut versuchen.</p>}
          <div className="flex gap-2.5">
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>{t.later}</Button>
            <Button type="submit" className="flex-1" disabled={!rating} busy={state === 'busy'}>{t.feedbackSend}</Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
