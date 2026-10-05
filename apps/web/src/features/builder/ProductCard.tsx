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

type Tone = Parameters<typeof Badge>[0]['tone'];

function productBadges(p: Product): { label: string; tone: Tone }[] {
  const upright = p.allowedOrientations.every((o) => UPRIGHT_ORIENTATIONS.includes(o));
  const out: { label: string; tone: Tone }[] = [];
  if (p.fragility >= 3) out.push({ label: 'Frágil', tone: 'red' });
  else if (p.fragility === 2) out.push({ label: 'Delicado', tone: 'amber' });
  if (p.compressibility >= 2) out.push({ label: 'Blando', tone: 'amber' });
  if (p.packagingType === 'LIQUID' || p.packagingType === 'BOTTLE') out.push({ label: 'Líquido', tone: 'blue' });
  if (!p.canSupportWeight) out.push({ label: 'Sin peso encima', tone: 'red' });
  if (upright) out.push({ label: p.packagingType === 'BAG' || p.packagingType === 'SOFT' ? 'Va acostado' : 'Este lado arriba', tone: 'neutral' });
  return out;
}

const MAX_BADGES = 2;

/**
 * Tarjeta de producto con estructura de altura fija (imagen, nombre de 2 líneas,
 * precio, medidas, etiquetas, estado y botón) para que todas midan lo mismo y la
 * cuadrícula quede alineada sin importar el contenido.
 */
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
  const blocked = status === 'nofit' || status === 'out';
  const reasonId = `reason-${p.id}`;
  const badges = productBadges(p);
  const shown = badges.slice(0, MAX_BADGES);
  const hidden = badges.slice(MAX_BADGES);
  const sub = substitutes[0];

  const label = {
    fits: qty > 0 ? 'Agregar otro' : 'Agregar',
    nofit: 'No cabe',
    out: 'Agotado',
    maxed: 'Sin más stock',
    pending: 'Calculando…',
    nobox: 'Elige una caja',
  }[status];

  const reason =
    status === 'nofit'
      ? `${check?.code ? FAILURE_LABELS[check.code] : 'No cabe'}: ${check?.message ?? ''}`
      : status === 'out'
        ? 'Producto agotado por ahora.'
        : status === 'maxed'
          ? `Ya agregaste todo el stock disponible (${p.available}).`
          : '';

  return (
    <article
      className={cx(
        'flex h-full w-full flex-col overflow-hidden rounded-xl bg-white ring-1 transition',
        qty > 0 ? 'ring-2 ring-brand-300' : 'ring-stone-200 hover:ring-stone-300',
      )}
      aria-label={p.name}
    >
      {/* Imagen: altura fija */}
      <div className="relative h-24 shrink-0">
        <ProductArt imageUrl={p.imageUrl} packagingType={p.packagingType} color={color} name={p.name} className={cx('h-full w-full', blocked && 'grayscale')} />
        {qty > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${qty} en la caja`}>
            {qty} en caja
          </span>
        )}
        {blocked && (
          <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-xs font-semibold text-white">{label}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {/* Nombre: siempre 2 líneas de alto */}
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5" title={p.name}>
          {p.name}
        </h3>

        <div className="mt-1 flex items-baseline justify-between gap-2 whitespace-nowrap">
          <span className="text-base font-semibold text-stone-900">{formatPrice(p.priceCents)}</span>
          <span className={cx('truncate text-xs', p.available === 0 ? 'text-red-700' : p.available <= 5 ? 'text-amber-700' : 'text-stone-500')}>
            {p.available > 0 ? `Stock ${p.available}` : 'Sin stock'}
          </span>
        </div>

        <p className="truncate text-xs text-stone-500" title={`${formatWeight(p.weightG)} · ${formatDims(p.lengthMm, p.widthMm, p.heightMm)}`}>
          {formatWeight(p.weightG)} · {formatDims(p.lengthMm, p.widthMm, p.heightMm)}
        </p>

        {/* Etiquetas: una sola línea */}
        <div className="mt-1.5 flex h-5 flex-nowrap gap-1 overflow-hidden">
          {shown.map((b) => (
            <Badge key={b.label} tone={b.tone} className="shrink-0 whitespace-nowrap">
              {b.label}
            </Badge>
          ))}
          {hidden.length > 0 && (
            <Badge className="shrink-0">
              <span title={hidden.map((b) => b.label).join(', ')} aria-hidden="true">
                +{hidden.length}
              </span>
              <span className="sr-only">También: {hidden.map((b) => b.label).join(', ')}</span>
            </Badge>
          )}
        </div>

        {/* Estado: altura fija (motivo en 2 líneas + sustituto en 1 línea) */}
        <div className="mt-2 h-[3.75rem] overflow-hidden text-xs leading-4">
          {status === 'fits' && <p className="text-emerald-700">✓ Cabe en tu caja</p>}
          {status === 'pending' && <p className="text-stone-500">Calculando acomodo…</p>}
          {reason && (
            <p id={reasonId} className={cx('line-clamp-2', status === 'nofit' ? 'text-red-700' : 'text-stone-600')} title={reason}>
              {reason}
            </p>
          )}
          {blocked && sub && (
            <button
              onClick={() => onAdd(sub.id)}
              className="mt-1 block w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-left text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
              title={`Sustituto que sí cabe: ${sub.name}`}
              aria-label={`Agregar sustituto ${sub.name}`}
            >
              + {sub.name}
            </button>
          )}
        </div>

        <Button
          className="mt-auto w-full shrink-0"
          size="sm"
          variant={status === 'fits' ? 'primary' : 'secondary'}
          disabled={status !== 'fits'}
          onClick={() => onAdd(p.id)}
          aria-describedby={reason ? reasonId : undefined}
          aria-label={status === 'fits' ? `Agregar ${p.name}` : `${label}: ${p.name}`}
        >
          {status === 'fits' ? `+ ${label}` : label}
        </Button>
      </div>
    </article>
  );
}
