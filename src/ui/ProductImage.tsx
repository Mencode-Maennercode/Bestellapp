import { useState } from 'react';
import { cx } from './cx';

const base = import.meta.env.BASE_URL;
const src = (key: string, w: 512 | 1024) => `${base}img/drinks/${key}-${w}.webp`;

const CONES = new Set(['bier', 'wein', 'softdrinks', 'kurze', 'glaeser']);

/** Category light colour as CSS value; unknown categories get a neutral cone. */
export const coneColor = (categoryId: string) => `var(--color-cone-${CONES.has(categoryId) ? categoryId : 'glaeser'})`;

interface Props {
  image?: string;
  categoryId: string;
  /** Rendered width hint for srcset selection. */
  sizes?: string;
  className?: string;
  dim?: boolean;
}

/**
 * Studio photo on pure black, blended with `screen` so the black melts into the surface
 * and the glass floats over a light cone tinted per category.
 */
export function ProductImage({ image, categoryId, sizes = '50vw', className, dim }: Props) {
  const fallback = `fallback-${CONES.has(categoryId) ? categoryId : 'glaeser'}`;
  const [key, setKey] = useState(image || fallback);
  const cone = coneColor(categoryId);
  return (
    <div className={cx('relative isolate overflow-hidden bg-surface-1', className)}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 transition-opacity duration-500"
        style={{
          opacity: dim ? 0.15 : 1,
          background: `radial-gradient(52% 46% at 50% 60%, color-mix(in oklab, ${cone} 46%, transparent), transparent 72%),
            radial-gradient(38% 9% at 50% 91%, color-mix(in oklab, ${cone} 34%, transparent), transparent 80%)`,
        }}
      />
      <img
        src={src(key, 512)}
        srcSet={`${src(key, 512)} 512w, ${src(key, 1024)} 1024w`}
        sizes={sizes}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => key !== fallback && setKey(fallback)}
        className={cx('size-full object-contain mix-blend-screen transition-[filter,opacity] duration-500', dim && 'opacity-40 grayscale')}
      />
    </div>
  );
}
