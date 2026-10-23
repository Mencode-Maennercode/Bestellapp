import { DotsSixVertical, Fire, PencilSimple, Plus, Prohibit, Rows } from '@phosphor-icons/react';
import { ref, update } from 'firebase/database';
import { Reorder, useDragControls } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { formatEUR, parseEUR } from '@shared/money';
import type { Product } from '@shared/types';
import { db } from '@/data/firebase';
import { Badge, Button, cx, ProductImage, useToast } from '@/ui';
import { useEvent } from '../context';
import { Card, useAction } from '../ui';
import { CategorySheet } from './CategorySheet';
import { ProductSheet } from './ProductSheet';

export function ProductsView() {
  const ev = useEvent();
  const { catalog, closed } = ev;
  const { run } = useAction();
  const categories = useMemo(() => Object.entries(catalog.categories).sort((a, b) => a[1].sort - b[1].sort), [catalog.categories]);
  const [cat, setCat] = useState<string>(() => categories.find(([, c]) => c.active)?.[0] ?? categories[0]?.[0] ?? '');
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [cats, setCats] = useState(false);

  const current = catalog.categories[cat] ? cat : (categories[0]?.[0] ?? '');
  const ids = useMemo(
    () =>
      Object.entries(catalog.products)
        .filter(([, p]) => p.categoryId === current)
        .sort((a, b) => a[1].sort - b[1].sort || a[1].name.localeCompare(b[1].name, 'de'))
        .map(([id]) => id),
    [catalog.products, current],
  );
  const [order, setOrder] = useState(ids);
  useEffect(() => setOrder(ids), [ids]);

  const base = `events/${ev.id}/catalog/products`;
  const patch = (id: string, fields: Record<string, unknown>, ok?: string) => run(() => update(ref(db, `${base}/${id}`), fields), ok);

  const commitOrder = (next: string[]) => {
    if (next.join() === ids.join()) return;
    const sorts: Record<string, number> = {};
    next.forEach((id, i) => (sorts[`${id}/sort`] = i + 1));
    void run(() => update(ref(db, base), sorts));
  };
  const move = (id: string, delta: -1 | 1) => {
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    commitOrder(next);
  };

  if (!categories.length) return <Card><p className="text-ink-2">Diese Veranstaltung hat noch keine Karte.</p></Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[2.5rem] leading-none font-extrabold uppercase">Karte</h2>
          <p className="mt-2 text-ink-2">Preise direkt antippen. Änderungen sind sofort bei Gästen und Kellnern.</p>
        </div>
        {!closed && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Rows size={20} weight="bold" />} onClick={() => setCats(true)}>Kategorien</Button>
            <Button icon={<Plus size={20} weight="bold" />} onClick={() => setEditing({ id: null })}>Neues Produkt</Button>
          </div>
        )}
      </div>
      {closed && <p role="status" className="rounded-[var(--radius-btn)] bg-surface-2 px-4 py-3 font-bold text-ink-2">Beendete Veranstaltung: die Karte bleibt als Archiv unverändert. Zum Weiterverwenden die Veranstaltung duplizieren.</p>}

      <div role="tablist" aria-label="Kategorie" className="no-scrollbar -mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)]">
        {categories.map(([id, c]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={current === id}
            onClick={() => setCat(id)}
            className={cx(
              'min-h-11 shrink-0 rounded-full px-4 font-bold transition-colors',
              current === id ? 'bg-ink text-bg' : 'bg-surface-1 text-ink-2 shadow-[var(--edge)] hover:text-ink',
              !c.active && 'opacity-60',
            )}
          >
            {c.name}
            {!c.active && ' (aus)'}
          </button>
        ))}
      </div>

      {order.length === 0 ? (
        <Card><p className="py-4 text-center text-ink-3">In dieser Kategorie ist noch nichts.</p></Card>
      ) : (
        <Reorder.Group as="ul" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-2">
          {order.map(id => {
            const p = catalog.products[id];
            return p ? <Row key={id} id={id} p={p} readOnly={closed} onPatch={patch} onEdit={() => setEditing({ id })} onCommit={() => commitOrder(order)} onMove={move} /> : null;
          })}
        </Reorder.Group>
      )}

      <ProductSheet state={editing} onClose={() => setEditing(null)} onMove={move} />
      <CategorySheet open={cats} onClose={() => setCats(false)} />
    </div>
  );
}

function Row({
  id, p, readOnly, onPatch, onEdit, onCommit, onMove,
}: {
  id: string;
  p: Product;
  readOnly: boolean;
  onPatch: (id: string, fields: Record<string, unknown>, ok?: string) => Promise<boolean>;
  onEdit: () => void;
  onCommit: () => void;
  onMove: (id: string, delta: -1 | 1) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="li" value={id} dragListener={false} dragControls={controls} onDragEnd={onCommit} className={cx('rounded-[var(--radius-card)] bg-surface-1 shadow-[var(--edge)]', !p.active && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 pr-3">
        {!readOnly && (
          <button
            type="button"
            aria-label={`${p.name} verschieben (Ziehen)`}
            onPointerDown={e => controls.start(e)}
            onKeyDown={e => {
              if (e.key === 'ArrowUp') { e.preventDefault(); onMove(id, -1); }
              if (e.key === 'ArrowDown') { e.preventDefault(); onMove(id, 1); }
            }}
            className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink active:cursor-grabbing"
          >
            <DotsSixVertical size={22} weight="bold" />
          </button>
        )}
        <ProductImage image={p.image} categoryId={p.categoryId} dim={!p.active} sizes="56px" className="size-14 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1 basis-40 leading-tight">
          <p className="truncate text-lg font-bold">{p.name}</p>
          <p className="truncate text-[0.875rem] text-ink-3">
            {[p.size, p.description].filter(Boolean).join(' · ') || ' '}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.tableSection && <Badge>Für den Tisch</Badge>}
            {p.glassPrompt && <Badge>Gläser-Frage</Badge>}
            {p.badge && <Badge>{p.badge}</Badge>}
          </div>
        </div>
        <PriceField cents={p.priceCents} disabled={readOnly} label={`Preis ${p.name}`} onCommit={c => onPatch(id, { priceCents: c }, `${p.name}: ${formatEUR(c)}`)} />
        <div className="flex items-center gap-1">
          <Toggle on={p.popular} label="Beliebt" disabled={readOnly} icon={<Fire size={20} weight={p.popular ? 'fill' : 'bold'} />} onClick={() => void onPatch(id, { popular: !p.popular })} />
          <Toggle on={p.soldOut} tone="late" label="Ausverkauft" disabled={readOnly} icon={<Prohibit size={20} weight="bold" />} onClick={() => void onPatch(id, { soldOut: !p.soldOut })} />
          <Toggle on={p.active} label={p.active ? 'Sichtbar' : 'Ausgeblendet'} disabled={readOnly} text={p.active ? 'An' : 'Aus'} onClick={() => void onPatch(id, { active: !p.active })} />
          {!readOnly && (
            <Button variant="quiet" aria-label={`${p.name} bearbeiten`} icon={<PencilSimple size={20} weight="bold" />} onClick={onEdit} className="min-h-11 px-3" />
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

function Toggle({
  on, label, onClick, icon, text, tone, disabled,
}: { on: boolean; label: string; onClick: () => void; icon?: React.ReactNode; text?: string; tone?: 'late'; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'grid min-h-11 min-w-11 place-items-center rounded-full px-2 text-[0.9375rem] font-bold transition-colors disabled:opacity-50',
        on ? (tone === 'late' ? 'bg-late text-[#1a0605]' : 'bg-accent-2 text-accent-2-ink') : 'bg-surface-3 text-ink-3 hover:text-ink',
      )}
    >
      {icon ?? text}
    </button>
  );
}

/** Price in euros as typed (2,50); saved on Enter or when leaving the field. Never floats: parsed to cents. */
function PriceField({ cents, onCommit, label, disabled }: { cents: number; onCommit: (cents: number) => Promise<boolean>; label: string; disabled?: boolean }) {
  const toast = useToast();
  const fmt = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const [text, setText] = useState(fmt(cents));
  useEffect(() => setText(fmt(cents)), [cents]);

  const commit = () => {
    const parsed = parseEUR(text);
    if (parsed === null || parsed > 100000) {
      toast({ message: 'Bitte einen Preis wie 2,50 eingeben.', tone: 'error' });
      setText(fmt(cents));
      return;
    }
    setText(fmt(parsed));
    if (parsed !== cents) void onCommit(parsed);
  };

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-label={label}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && (e.currentTarget.blur())}
        onFocus={e => e.currentTarget.select()}
        className="num min-h-11 w-24 rounded-[12px] bg-surface-3 px-3 text-right text-[1.5rem] leading-none font-bold shadow-[var(--edge)] disabled:opacity-60"
      />
      <span aria-hidden className="text-ink-3">€</span>
    </label>
  );
}

