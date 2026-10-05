import { formatDims, formatPrice, formatWeight, usableWeightG, type Box } from '@bmb/shared';
import { cx } from '../../components/ui';

export function BoxSelector({ boxes, selectedId, onSelect, large = false }: { boxes: Box[]; selectedId?: string; onSelect: (id: string) => void; large?: boolean }) {
  return (
    <fieldset>
      <legend className={cx('font-semibold text-stone-800', large ? 'mb-3 text-lg' : 'sr-only')}>Elige el tamaño de tu caja</legend>
      <div className={cx('grid gap-2', large ? 'sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3')}>
        {boxes.map((b) => {
          const active = b.id === selectedId;
          return (
            <label
              key={b.id}
              className={cx(
                'flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600',
                active ? 'ring-2 ring-brand-600' : 'ring-stone-200 hover:ring-stone-400',
              )}
            >
              <input type="radio" name="box" value={b.id} checked={active} onChange={() => onSelect(b.id)} className="mt-1 accent-brand-600" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-sm font-semibold text-brand-700">{formatPrice(b.priceCents)}</span>
                </span>
                <span className="block text-xs text-stone-600">
                  {formatDims(b.innerLengthMm, b.innerWidthMm, b.innerHeightMm)} · hasta {formatWeight(b.maxWeightG)}
                </span>
                {large && (
                  <span className="mt-1 block text-xs text-stone-500">
                    {b.description} Peso útil {formatWeight(usableWeightG(b))} (margen de seguridad {b.safetyMarginPct}%).
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
