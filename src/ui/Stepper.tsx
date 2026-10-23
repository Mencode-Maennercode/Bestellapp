import { Minus, Plus } from '@phosphor-icons/react';
import { cx } from './cx';

interface Props {
  value: number;
  onChange: (next: number) => void;
  label: string;
  max?: number;
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'accent';
  className?: string;
}

/** − 2 + pill. Buttons stay 44–48 px so they are hittable with a glass in the other hand. */
export function Stepper({ value, onChange, label, max = 50, size = 'md', tone = 'neutral', className }: Props) {
  const btn = cx(
    size === 'sm' ? 'size-11' : 'size-12',
    'grid place-items-center rounded-full disabled:opacity-35',
    tone === 'accent' ? 'active:bg-black/15' : 'active:bg-surface-2',
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'inline-flex items-center rounded-full',
        tone === 'accent' ? 'bg-accent-2 text-accent-2-ink' : 'bg-surface-3 text-ink shadow-[var(--edge)]',
        className,
      )}
    >
      <button type="button" className={btn} onClick={e => { e.stopPropagation(); onChange(value - 1); }} aria-label={`${label}: eins weniger`}>
        <Minus size={18} weight="bold" />
      </button>
      <output aria-live="polite" className="num min-w-7 text-center text-[1.625rem] leading-none font-bold">{value}</output>
      <button
        type="button"
        className={btn}
        onClick={e => { e.stopPropagation(); onChange(value + 1); }}
        disabled={value >= max}
        aria-label={`${label}: eins mehr`}
      >
        <Plus size={18} weight="bold" />
      </button>
    </div>
  );
}
