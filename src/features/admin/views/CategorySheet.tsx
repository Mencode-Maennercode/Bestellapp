import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { ref, remove, set, update } from 'firebase/database';
import { useState } from 'react';
import { slugify, uniqueId } from '@shared/slug';
import { db } from '@/data/firebase';
import { Button, Sheet } from '@/ui';
import { useEvent } from '../context';
import { inputClass, useAction } from '../ui';

/** Rename, hide, reorder, add and remove categories of the selected event. */
export function CategorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ev = useEvent();
  const { run } = useAction();
  const [name, setName] = useState('');
  const base = `events/${ev.id}/catalog/categories`;
  const list = Object.entries(ev.catalog.categories).sort((a, b) => a[1].sort - b[1].sort);
  const used = (id: string) => Object.values(ev.catalog.products).some(p => p.categoryId === id);

  const swap = (i: number, d: -1 | 1) => {
    const a = list[i];
    const b = list[i + d];
    if (!a || !b) return;
    void run(() => update(ref(db, base), { [`${a[0]}/sort`]: b[1].sort, [`${b[0]}/sort`]: a[1].sort }));
  };
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const id = uniqueId(slugify(n), Object.keys(ev.catalog.categories));
    const sort = (list.length ? Math.max(...list.map(([, c]) => c.sort)) : 0) + 1;
    if (await run(() => set(ref(db, `${base}/${id}`), { name: n, sort, active: true }), 'Kategorie angelegt')) setName('');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Kategorien" subtitle="Ausgeblendete Kategorien verschwinden samt Produkten von der Karte">
      <ul className="flex flex-col gap-2 pb-3">
        {list.map(([id, c], i) => (
          <li key={id} className="flex items-center gap-2 rounded-[var(--radius-btn)] bg-surface-3 p-1.5 pl-3 shadow-[var(--edge)]">
            <input
              defaultValue={c.name}
              aria-label={`Name der Kategorie ${c.name}`}
              maxLength={30}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== c.name) void run(() => update(ref(db, `${base}/${id}`), { name: v }));
                else e.target.value = c.name;
              }}
              className="min-h-11 min-w-0 flex-1 bg-transparent font-bold"
            />
            <Button variant="quiet" aria-label="Nach oben" disabled={i === 0} icon={<ArrowUp size={18} weight="bold" />} onClick={() => swap(i, -1)} className="min-h-11 px-3" />
            <Button variant="quiet" aria-label="Nach unten" disabled={i === list.length - 1} icon={<ArrowDown size={18} weight="bold" />} onClick={() => swap(i, 1)} className="min-h-11 px-3" />
            <button
              type="button"
              role="switch"
              aria-checked={c.active}
              onClick={() => void run(() => update(ref(db, `${base}/${id}`), { active: !c.active }))}
              className={`min-h-11 rounded-full px-3 font-bold ${c.active ? 'bg-accent-2 text-accent-2-ink' : 'bg-surface-1 text-ink-3'}`}
            >
              {c.active ? 'An' : 'Aus'}
            </button>
            <Button
              variant="quiet"
              aria-label={used(id) ? 'Nicht möglich: Kategorie hat noch Produkte' : `${c.name} entfernen`}
              title={used(id) ? 'Erst die Produkte verschieben oder entfernen' : 'Entfernen'}
              disabled={used(id)}
              icon={<Trash size={18} weight="bold" />}
              onClick={() => void run(() => remove(ref(db, `${base}/${id}`)), 'Kategorie entfernt')}
              className="min-h-11 px-3"
            />
          </li>
        ))}
      </ul>
      <form className="flex gap-2 pb-2" onSubmit={e => { e.preventDefault(); void add(); }}>
        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={30} placeholder="Neue Kategorie, z. B. Heißgetränke" aria-label="Name der neuen Kategorie" />
        <Button type="submit" disabled={!name.trim()} icon={<Plus size={20} weight="bold" />}>Anlegen</Button>
      </form>
    </Sheet>
  );
}
