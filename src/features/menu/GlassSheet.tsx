import type { Catalog, GlassType } from '@shared/types';
import { NumberGrid, Sheet } from '@/ui';
import type { CartApi } from './useCart';
import type { MenuStrings } from './strings';

const PLURAL: Record<GlassType, string> = { beer: 'Biergläser', wine: 'Weingläser', sekt: 'Sektgläser' };

/** "Wie viele Gläser?" after a bottle was added. One tap answers; 0 adds none. */
export function GlassSheet({ cart, catalog, s }: { cart: CartApi; catalog: Catalog; s: MenuStrings }) {
  const prompt = cart.glassPrompt;
  const bottle = prompt ? catalog.products[prompt.productId] : null;
  return (
    <Sheet
      level={2}
      open={!!prompt}
      onClose={() => cart.answerGlasses(0)}
      title={s.glassesTitle}
      subtitle={prompt && bottle ? `${PLURAL[prompt.type]} für ${bottle.name}` : undefined}
    >
      <div className="pt-1 pb-2">
        <NumberGrid to={8} onPick={cart.answerGlasses} zeroLabel={s.noGlasses} label={s.glassesTitle} />
      </div>
    </Sheet>
  );
}
