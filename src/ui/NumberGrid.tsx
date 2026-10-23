import { cx } from './cx';

interface Props {
  from?: number;
  to: number;
  value?: number | null;
  onPick: (n: number) => void;
  /** Label for 0, e.g. "Keine". */
  zeroLabel?: string;
  label: string;
}

/** Big tap grid for small numbers (glasses, table numbers). One tap picks. */
export function NumberGrid({ from = 0, to, value, onPick, zeroLabel, label }: Props) {
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2.5">
      {nums.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-pressed={value === n}
          className={cx(
            'min-h-16 rounded-[var(--radius-btn)] leading-none font-bold transition-[transform,background-color] duration-150 active:scale-95',
            value === n ? 'bg-accent text-accent-ink' : 'surface-3 text-ink hover:bg-[#28322b]',
            n === 0 && zeroLabel ? 'text-lg' : 'num text-[2.125rem]',
          )}
        >
          {n === 0 && zeroLabel ? zeroLabel : n}
        </button>
      ))}
    </div>
  );
}
