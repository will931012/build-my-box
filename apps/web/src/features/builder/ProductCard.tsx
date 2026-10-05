import { FAILURE_LABELS, formatDims, formatPrice, formatWeight, UPRIGHT_ORIENTATIONS, type AdditionCheck, type Product } from '@bmb/shared';
import { ProductArt } from '../../components/ProductArt';
import { Badge, Button, cx } from '../../components/ui';

export type AddStatus = 'fits' | 'nofit' | 'out' | 'maxed' | 'pending' | 'nobox';

export function addStatus(p: Product, qty: number, check: AdditionCheck | undefined, pending: boolean, hasBox: boolean): AddStatus {
  if (p.available <= 0) return 'out';
  if (qty >= p.available) return 'maxed';
  if (!hasBox) return 'nobox';
  if (pending || !check) return 'pending';
  return check.fits ? 'fits' : 'nofit';
}

export function ProductCard({
  product: p,
  qty,
  status,
  check,
  color,
  substitutes,
  onAdd,
}: {
  product: Product;
  qty: number;
  status: AddStatus;
  check?: AdditionCheck;
  color: string;
  substitutes: Product[];
  onAdd: (id: string) => void;
}) {
  const disabled = status !== 'fits';
  const upright = p.allowedOrientations.every((o) => UPRIGHT_ORIENTATIONS.includes(o));
  const reasonId = `reason-${p.id}`;

  const label = {
    fits: qty > 0 ? 'Agregar otro' : 'Agregar',
    nofit: 'No cabe',
    out: 'Agotado',
    maxed: 'Sin más stock',
    pending: 'Calculando…',
    nobox: 'Elige una caja',
  }[status];

  return (
    <article
      className={cx(
        'flex flex-col overflow-hidden rounded-xl bg-white ring-1 transition',
        status === 'nofit' || status === 'out' ? 'ring-stone-200 opacity-90' : 'ring-stone-200 hover:ring-stone-300',
        qty > 0 && 'ring-2 ring-brand-300',
      )}
      aria-label={p.name}
    >
      <div className="relative">
        <ProductArt imageUrl={p.imageUrl} packagingType={p.packagingType} color={color} name={p.name} className={cx('h-24 w-full', (status === 'nofit' || status === 'out') && 'grayscale')} />
        {qty > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${qty} en la caja`}>
            {qty} en caja
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm font-semibold leading-tight">{p.name}</h3>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
          <span className="font-semibold text-stone-900">{formatPrice(p.priceCents)}</span>
          <span className={cx('text-xs', p.available <= 5 ? 'text-amber-700' : 'text-stone-500')}>
            {p.available > 0 ? `Stock: ${p.available}` : 'Sin stock'}
          </span>
        </div>
        <p className="text-xs text-stone-500">
          {formatWeight(p.weightG)} · {formatDims(p.lengthMm, p.widthMm, p.heightMm)}
        </p>
        <div className="flex flex-wrap gap-1">
          {p.fragility >= 3 && <Badge tone="red">Frágil</Badge>}
          {p.fragility === 2 && <Badge tone="amber">Delicado</Badge>}
          {p.compressibility >= 2 && <Badge tone="amber">Blando</Badge>}
          {(p.packagingType === 'LIQUID' || p.packagingType === 'BOTTLE') && <Badge tone="blue">Líquido</Badge>}
          {upright && <Badge>{p.packagingType === 'BAG' || p.packagingType === 'SOFT' ? 'Va acostado' : 'Este lado arriba'}</Badge>}
          {!p.canSupportWeight && <Badge tone="red">Sin peso encima</Badge>}
        </div>

        <div className="mt-auto pt-1">
          <Button
            className="w-full"
            size="sm"
            variant={status === 'fits' ? 'primary' : 'secondary'}
            disabled={disabled}
            onClick={() => onAdd(p.id)}
            aria-describedby={status === 'nofit' || status === 'out' ? reasonId : undefined}
            aria-label={status === 'fits' ? `Agregar ${p.name}` : `${label}: ${p.name}`}
          >
            {status === 'fits' ? '+ ' : ''}
            {label}
          </Button>
          {status === 'nofit' && check?.message && (
            <p id={reasonId} className="mt-1.5 text-xs text-red-700">
              <strong>{check.code ? FAILURE_LABELS[check.code] : 'No cabe'}:</strong> {check.message}
            </p>
          )}
          {status === 'out' && (
            <p id={reasonId} className="mt-1.5 text-xs text-stone-600">
              Producto agotado.
            </p>
          )}
          {(status === 'nofit' || status === 'out') && substitutes.length > 0 && (
            <div className="mt-1.5 text-xs">
              <p className="text-stone-600">Sustitutos que sí caben:</p>
              <ul className="mt-0.5 flex flex-wrap gap-1">
                {substitutes.map((s) => (
                  <li key={s.id}>
                    <button className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100" onClick={() => onAdd(s.id)}>
                      + {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
