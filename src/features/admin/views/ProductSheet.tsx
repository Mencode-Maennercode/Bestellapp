import { ArrowDown, ArrowUp, Check, Trash } from '@phosphor-icons/react';
import { ref, remove, set, update } from 'firebase/database';
import { useState } from 'react';
import { formatEUR, parseEUR } from '@shared/money';
import { slugify, uniqueId } from '@shared/slug';
import type { GlassType, Product, TableSection } from '@shared/types';
import { db } from '@/data/firebase';
import { Button, cx, ProductImage, Sheet } from '@/ui';
import { useEvent } from '../context';
import { GALLERY } from '../gallery';
import { ConfirmSheet, SelectInput, TextInput, useAction } from '../ui';

const SECTIONS: [TableSection | '', string][] = [
  ['', 'Normales Getränk (in der Kategorie)'],
  ['bottle-nonalc', 'Für den Tisch: Flaschen alkoholfrei'],
  ['beer-crate', 'Für den Tisch: Bierkisten'],
  ['wine-bottle', 'Für den Tisch: Wein & Sekt (Flaschen)'],
  ['shots-crate', 'Für den Tisch: Kisten Kurze'],
];

const GLASSES: [GlassType | '', string][] = [['', 'Keine Frage'], ['beer', 'Bierglas'], ['wine', 'Weinglas'], ['sekt', 'Sektglas']];

/** Create or edit a product. Only the fields the database rules know are written. */
export function ProductSheet({ state, onClose, onMove }: { state: { id: string | null } | null; onClose: () => void; onMove: (id: string, delta: -1 | 1) => void }) {
  const ev = useEvent();
  const product = state?.id ? ev.catalog.products[state.id] : undefined;
  return (
    <Sheet open={!!state} onClose={onClose} title={state?.id ? 'Produkt bearbeiten' : 'Neues Produkt'}>
      {state && (
        <Form key={state.id ?? 'new'} id={state.id} product={product} onClose={onClose} onMove={onMove} />
      )}
    </Sheet>
  );
}

function Form({ id, product, onClose, onMove }: { id: string | null; product?: Product; onClose: () => void; onMove: (id: string, delta: -1 | 1) => void }) {
  const ev = useEvent();
  const { busy, run } = useAction();
  const categories = Object.entries(ev.catalog.categories).sort((a, b) => a[1].sort - b[1].sort);
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.[0] ?? '');
  const [size, setSize] = useState(product?.size ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [badge, setBadge] = useState(product?.badge ?? '');
  const [image, setImage] = useState(product?.image ?? '');
  const [glass, setGlass] = useState<GlassType | ''>(product?.glassPrompt ?? '');
  const [section, setSection] = useState<TableSection | ''>(product?.tableSection ?? '');
  const [popular, setPopular] = useState(product?.popular ?? false);
  const [removing, setRemoving] = useState(false);

  const cents = parseEUR(price);
  const valid = name.trim().length > 0 && cents !== null && cents <= 100000 && !!categoryId;
  const isGlassProduct = !!product?.glassFor;

  const save = async () => {
    if (!valid || cents === null) return;
    const base = `events/${ev.id}/catalog/products`;
    const common = {
      name: name.trim(), categoryId, priceCents: cents, popular,
      size: size.trim() || null, description: description.trim() || null, badge: badge.trim() || null,
      image: image || null, glassPrompt: glass || null, tableSection: section || null,
    };
    const ok = await run(async () => {
      if (id) {
        await update(ref(db, `${base}/${id}`), common);
      } else {
        const sorts = Object.values(ev.catalog.products).filter(p => p.categoryId === categoryId).map(p => p.sort);
        const newId = uniqueId(slugify(name), Object.keys(ev.catalog.products));
        const clean = Object.fromEntries(Object.entries(common).filter(([, v]) => v !== null));
        await set(ref(db, `${base}/${newId}`), { ...clean, soldOut: false, active: true, sort: (sorts.length ? Math.max(...sorts) : 0) + 1 });
      }
    }, id ? 'Gespeichert' : 'Produkt angelegt');
    if (ok) onClose();
  };

  return (
    <form className="flex flex-col gap-4 pb-2" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <TextInput label="Name" value={name} onChange={e => setName(e.target.value)} maxLength={40} required autoFocus={!id} />
        <TextInput label="Preis (€)" value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder="2,50" required aria-invalid={price !== '' && cents === null} />
      </div>
      <SelectInput label="Kategorie" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
        {categories.map(([cid, c]) => <option key={cid} value={cid}>{c.name}</option>)}
      </SelectInput>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr_8rem]">
        <TextInput label="Größe" value={size} onChange={e => setSize(e.target.value)} maxLength={20} placeholder="0,33 l" />
        <TextInput label="Beschreibung" value={description} onChange={e => setDescription(e.target.value)} maxLength={80} placeholder="z. B. trocken" />
        <TextInput label="Siegel" value={badge} onChange={e => setBadge(e.target.value)} maxLength={10} placeholder="0,0 %" />
      </div>

      <fieldset>
        <legend className="mb-2 text-[0.9375rem] font-bold text-ink-2">Foto</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          <ImageChoice label="Standard der Kategorie" selected={image === ''} onClick={() => setImage('')}>
            <ProductImage categoryId={categoryId} sizes="88px" className="aspect-square w-full rounded-[10px]" />
          </ImageChoice>
          {GALLERY.map(g => (
            <ImageChoice key={g.key} label={g.label} selected={image === g.key} onClick={() => setImage(g.key)}>
              <ProductImage image={g.key} categoryId={categoryId} sizes="88px" className="aspect-square w-full rounded-[10px]" />
            </ImageChoice>
          ))}
        </div>
      </fieldset>

      {!isGlassProduct && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Frage nach leeren Gläsern" value={glass} onChange={e => setGlass(e.target.value as GlassType | '')} hint="Beim Bestellen einer Flasche: „Wie viele Gläser?“">
            {GLASSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelectInput>
          <SelectInput label="Wo erscheint es?" value={section} onChange={e => setSection(e.target.value as TableSection | '')}>
            {SECTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelectInput>
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={popular}
        onClick={() => setPopular(!popular)}
        className="flex min-h-12 items-center justify-between rounded-[var(--radius-btn)] bg-surface-3 px-4 text-left font-bold shadow-[var(--edge)]"
      >
        Als „Beliebt“ ganz oben zeigen
        <span className={cx('rounded-full px-3 py-0.5 text-[0.875rem]', popular ? 'bg-accent-2 text-accent-2-ink' : 'bg-surface-1 text-ink-3')}>{popular ? 'Ja' : 'Nein'}</span>
      </button>

      {id && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] font-bold text-ink-2">Position</span>
          <Button type="button" variant="secondary" icon={<ArrowUp size={18} weight="bold" />} onClick={() => onMove(id, -1)} className="min-h-11">Höher</Button>
          <Button type="button" variant="secondary" icon={<ArrowDown size={18} weight="bold" />} onClick={() => onMove(id, 1)} className="min-h-11">Tiefer</Button>
          <span className="flex-1" />
          <Button type="button" variant="quiet" icon={<Trash size={18} weight="bold" />} onClick={() => setRemoving(true)} className="min-h-11 text-late">Entfernen</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button type="submit" busy={busy} disabled={!valid} icon={<Check size={20} weight="bold" />}>Speichern{cents !== null && name ? ` · ${formatEUR(cents)}` : ''}</Button>
      </div>

      <ConfirmSheet
        open={removing}
        onClose={() => setRemoving(false)}
        title="Produkt entfernen?"
        confirmLabel="Entfernen"
        busy={busy}
        onConfirm={() => id && void run(() => remove(ref(db, `events/${ev.id}/catalog/products/${id}`)), 'Entfernt').then(ok => ok && (setRemoving(false), onClose()))}
      >
        <p><strong className="text-ink">{product?.name}</strong> verschwindet von der Karte. Bereits abgeschlossene Bestellungen und die Statistik bleiben unverändert.</p>
        <p>Nur vorübergehend nicht anbieten? Dann lieber „Ausverkauft“ oder „Aus“ in der Liste nutzen.</p>
      </ConfirmSheet>
    </form>
  );
}

function ImageChoice({ children, label, selected, onClick }: { children: React.ReactNode; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx('flex flex-col gap-1 rounded-[12px] p-1 text-center text-[0.75rem] leading-tight font-bold', selected ? 'bg-accent-2 text-accent-2-ink' : 'bg-surface-3 text-ink-2 hover:text-ink')}
    >
      {children}
      <span className="line-clamp-2 min-h-[2lh] px-0.5">{label}</span>
    </button>
  );
}
