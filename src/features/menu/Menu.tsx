import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog } from '@shared/types';
import { cx } from '@/ui';
import type { CartApi } from './useCart';
import { GlassSheet } from './GlassSheet';
import { ProductCard } from './ProductCard';
import { buildSections, type Rank } from './sections';
import type { MenuStrings } from './strings';
import { TableGroups } from './TableGroups';

interface Props {
  catalog: Catalog;
  cart: CartApi;
  s: MenuStrings;
  /** Ordering switched off (paused): the menu stays readable but nothing can be added. */
  disabled?: boolean;
  /** Anchor id, e.g. for a "Bestellen" button that scrolls here. */
  id?: string;
  /** Height of a sticky header above the menu (waiter view); the category bar sticks below it. */
  offset?: string;
  /** Waiter view: order counts of this event; the most ordered drinks come first. */
  rank?: Rank;
  /** Waiter view: magnifier in the category bar to find a drink by name. */
  searchable?: boolean;
}

const fold = (t: string) => t.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss');

/** One menu for guests and waiters: category tabs, photo grid, table row, glasses question. */
export function Menu({ catalog, cart, s, disabled, id = 'karte', offset, rank, searchable }: Props) {
  const sections = useMemo(() => buildSections(catalog, { popular: s.popular, forTable: s.forTable }, rank), [catalog, s, rank]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return null;
    return Object.entries(catalog.products)
      .filter(([, p]) => p.active && catalog.categories[p.categoryId]?.active)
      .filter(([, p]) => fold([p.name, p.size, p.description].filter(Boolean).join(' ')).includes(needle))
      .sort((a, b) => (rank?.[b[0]] ?? 0) - (rank?.[a[0]] ?? 0) || a[1].sort - b[1].sort);
  }, [q, catalog, rank]);
  const closeSearch = () => {
    setSearching(false);
    setQ('');
  };
  const [active, setActive] = useState(sections[0]?.id);
  const tabs = useRef<HTMLDivElement>(null);
  const clickLock = useRef(0);

  // Scroll spy: the section crossing the upper third of the screen is the active tab.
  useEffect(() => {
    const els = sections.map(sec => document.getElementById(`sec-${sec.id}`)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      entries => {
        if (Date.now() < clickLock.current) return;
        const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.slice(4));
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  useEffect(() => {
    const chip = tabs.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!chip || !tabs.current) return;
    const bar = tabs.current;
    bar.scrollTo({
      left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [active]);

  const jump = (secId: string) => {
    setActive(secId);
    clickLock.current = Date.now() + 900;
    document.getElementById(`sec-${secId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id={id} aria-label={s.menuNav} className="@container">
      <nav
        aria-label={s.menuNav}
        className="sticky top-0 z-20 -mx-[var(--gutter)] bg-bg/94 pt-[var(--safe-top)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-bg"
        style={offset ? { top: offset, paddingTop: 0 } : undefined}
      >
        {searching ? (
          <div className="flex items-center gap-2 px-[var(--gutter)] py-3">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-surface-1 pr-1 pl-4 shadow-[var(--edge)] focus-within:outline-2 focus-within:outline-accent-2">
              <MagnifyingGlass size={20} weight="bold" aria-hidden className="shrink-0 text-ink-3" />
              <input
                autoFocus
                type="search"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && closeSearch()}
                placeholder="Getränk suchen"
                aria-label="Getränk suchen"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[1.0625rem] outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Suche schließen"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-1 text-ink-2 shadow-[var(--edge)] hover:text-ink"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        ) : (
          <div ref={tabs} className="no-scrollbar flex gap-2 overflow-x-auto px-[var(--gutter)] py-3">
            {searchable && (
              <button
                type="button"
                onClick={() => {
                  setSearching(true);
                  window.scrollTo({ top: 0 });
                }}
                aria-label="Getränk suchen"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-1 text-ink-2 shadow-[var(--edge)] hover:text-ink"
              >
                <MagnifyingGlass size={20} weight="bold" />
              </button>
            )}
            {sections.map(sec => (
              <button
                key={sec.id}
                type="button"
                data-tab={sec.id}
                onClick={() => jump(sec.id)}
                aria-current={active === sec.id ? 'true' : undefined}
                className={cx(
                  'min-h-11 shrink-0 rounded-full px-4.5 text-[0.9375rem] font-bold transition-colors duration-200',
                  active === sec.id ? 'bg-ink text-bg' : 'bg-surface-1 text-ink-2 shadow-[var(--edge)] hover:text-ink',
                )}
              >
                {sec.title}
              </button>
            ))}
          </div>
        )}
      </nav>

      {hits && (
        <section aria-label="Suchergebnisse" className="pt-5 pb-4">
          {hits.length ? (
            <div className="grid grid-cols-2 gap-2.5 @xl:grid-cols-3 @4xl:grid-cols-4">
              {hits.map(([pid, p]) => (
                <ProductCard key={pid} id={pid} product={p} qty={cart.cart[pid] ?? 0} onAdd={cart.add} onChange={cart.change} s={s} disabled={disabled} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-lg text-ink-3">Nichts gefunden für „{q.trim()}“</p>
          )}
        </section>
      )}

      {sections.map(sec => (
        <section
          key={sec.id}
          hidden={!!hits}
          id={`sec-${sec.id}`}
          aria-labelledby={`h-${sec.id}`}
          className="scroll-mt-[calc(var(--safe-top)+4.5rem)] pt-5 pb-4"
          style={offset ? { scrollMarginTop: `calc(${offset} + 4.5rem)` } : undefined}
        >
          <h2 id={`h-${sec.id}`} className="mb-3.5 font-display text-[2rem] leading-none font-extrabold uppercase">
            {sec.title}
          </h2>
          {sec.kind === 'table' ? (
            <TableGroups groups={sec.groups} cart={cart} s={s} disabled={disabled} />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 @xl:grid-cols-3 @4xl:grid-cols-4">
              {sec.products.map(([pid, p]) => (
                <ProductCard key={pid} id={pid} product={p} qty={cart.cart[pid] ?? 0} onAdd={cart.add} onChange={cart.change} s={s} disabled={disabled} />
              ))}
            </div>
          )}
        </section>
      ))}

      <GlassSheet cart={cart} catalog={catalog} s={s} />
    </section>
  );
}
