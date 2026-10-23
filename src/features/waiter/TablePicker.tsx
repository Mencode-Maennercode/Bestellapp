import type { Table } from '@shared/types';
import { cx } from '@/ui';
import { sortedTables } from '@/features/staff/useStaff';

interface Props {
  tables: Record<string, Table>;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Table id → colleague name, shown under the number so nobody double-books by accident. */
  takenBy?: Record<string, string>;
  /** One tap picks one table (ordering for a table that is not mine). */
  onPick?: (id: string) => void;
}

/** Number grid of all tables (12, 14, 56a …). Tap toggles; several at once. */
export function TablePicker({ tables, value, onChange, takenBy = {}, onPick }: Props) {
  const list = sortedTables(tables);
  const set = new Set(value);
  const toggle = (id: string) => (onPick ? onPick(id) : onChange(set.has(id) ? value.filter(v => v !== id) : [...value, id]));

  if (!list.length) return <p className="py-6 text-ink-3">Für diese Veranstaltung sind noch keine Tische angelegt.</p>;

  return (
    <div>
      <div className={cx('mb-3 flex items-center justify-between gap-3', onPick && 'hidden')}>
        <p className="text-ink-2" aria-live="polite">
          <span className="num text-xl font-bold text-ink">{value.length}</span> {value.length === 1 ? 'Tisch' : 'Tische'} gewählt
        </p>
        <button
          type="button"
          onClick={() => onChange(value.length ? [] : list.map(([id]) => id))}
          className="min-h-11 rounded-[10px] px-3 font-bold text-accent-2 hover:bg-surface-3"
        >
          {value.length ? 'Keine' : 'Alle'}
        </button>
      </div>
      <div role="group" aria-label="Tische" className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2">
        {list.map(([id, t]) => {
          const on = set.has(id);
          const other = takenBy[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={`Tisch ${t.label}${other ? `, auch bei ${other}` : ''}`}
              onClick={() => toggle(id)}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center rounded-[var(--radius-btn)] px-1 transition-[transform,background-color] duration-150 active:scale-95',
                on ? 'bg-accent text-accent-ink' : 'surface-3 text-ink hover:bg-[#28322b]',
              )}
            >
              <span className="num text-[1.875rem] leading-none font-extrabold">{t.label}</span>
              {other && <span className={cx('mt-1 max-w-full truncate text-[0.75rem] leading-none font-bold', on ? 'opacity-75' : 'text-ink-3')}>{other}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
