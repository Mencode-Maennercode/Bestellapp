/** URL-safe lowercase id (also valid as a Firebase key and for the product-image regex). */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'x'
  );
}

/** `base`, or `base-2`, `base-3` … – whichever is not in `taken` yet. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base.slice(0, 36)}-${n}`;
    if (!used.has(id)) return id;
  }
}
