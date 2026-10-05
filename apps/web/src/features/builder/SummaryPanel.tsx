import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  buildRecommendations,
  FAILURE_LABELS,
  formatPercent,
  formatPrice,
  formatVolumeLiters,
  formatWeight,
  STATUS_LABELS,
  type PackingStatus,
} from '@bmb/shared';
import { Alert, Badge, Button, Card, cx, Progress, Spinner } from '../../components/ui';
import { useCart } from '../../store/cart';
import type { BuilderState } from './useBuilder';

const statusTone: Record<PackingStatus, 'neutral' | 'green' | 'red' | 'amber'> = {
  EMPTY: 'neutral',
  FITS: 'green',
  DOES_NOT_FIT: 'red',
  EXCEEDS_WEIGHT: 'red',
};

export function SummaryPanel({ state, onAdd, className }: { state: BuilderState; onAdd: (id: string) => void; className?: string }) {
  const { box, lines, analysis, pending, colors, products, quantities, stockIssues, subtotalCents } = state;
  const { decrement, remove, clear } = useCart();
  const result = analysis?.result;

  const recs = useMemo(
    () => (analysis && !pending ? buildRecommendations({ result: analysis.result, additions: analysis.additions, catalog: products, quantities }) : []),
    [analysis, pending, products, quantities],
  );
  if (!box) return null;

  const t = result?.totals;
  const weightRatio = t ? t.weightG / t.usableWeightG : 0;
  const nearLimit = weightRatio >= 0.85;
  const canCheckout = !pending && result?.status === 'FITS' && stockIssues.length === 0 && lines.length > 0;
  const fittingCount = analysis ? products.filter((p) => analysis.additions[p.id]?.fits && p.available > (quantities[p.id] ?? 0)).length : 0;

  return (
    <Card className={cx('flex flex-col gap-4 p-4', className)} aria-labelledby="summary-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="summary-title" className="text-lg font-semibold">
            Resumen de la caja
          </h2>
          <p className="text-xs text-stone-600">{box.name}</p>
        </div>
        <div aria-live="polite">
          {pending ? (
            <Badge>
              <Spinner className="size-3" label="Recalculando acomodo" /> Recalculando
            </Badge>
          ) : result ? (
            <Badge tone={result.status === 'FITS' && nearLimit ? 'amber' : statusTone[result.status]} className="text-sm">
              {result.status === 'FITS' && fittingCount === 0 ? 'Caja llena' : STATUS_LABELS[result.status]}
            </Badge>
          ) : null}
        </div>
      </div>

      {t && (
        <div className="flex flex-col gap-3">
          <Progress
            label="Peso"
            value={weightRatio}
            tone={weightRatio > 1 ? 'red' : nearLimit ? 'amber' : 'brand'}
            detail={`${formatWeight(t.weightG)} / ${formatWeight(t.usableWeightG)}`}
          />
          <Progress
            label="Espacio utilizado (estimado)"
            value={t.volumeUtilization}
            tone="green"
            detail={`${formatPercent(t.volumeUtilization)} · libre ≈ ${formatVolumeLiters(Math.max(0, t.usableVolumeMm3 - t.itemsVolumeMm3))}`}
          />
          <p className="text-xs text-stone-500">
            Quedan {formatWeight(Math.max(0, t.usableWeightG - t.weightG))} de peso útil. Peso máximo de la caja {formatWeight(t.maxWeightG)}, con margen de
            seguridad del {box.safetyMarginPct}%. La capacidad real la decide el acomodo físico, no solo el volumen:
            {' '}
            <strong>{fittingCount}</strong> productos del catálogo todavía caben.
          </p>
        </div>
      )}

      {/* Productos agregados */}
      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Productos ({lines.reduce((s, l) => s + l.quantity, 0)})</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-stone-600">Todavía no agregaste productos.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {lines.map((l) => {
              const canInc = !pending && analysis?.additions[l.product.id]?.fits && l.quantity < l.product.available;
              return (
                <li key={l.product.id} className="flex items-center gap-2 py-1.5">
                  <span className="size-3 shrink-0 rounded-sm ring-1 ring-black/20" style={{ background: colors.get(l.product.id) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{l.product.name}</span>
                    <span className="text-xs text-stone-500">
                      {formatPrice(l.product.priceCents)} · {formatWeight(l.product.weightG * l.quantity)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => decrement(l.product.id)} aria-label={`Quitar una unidad de ${l.product.name}`}>
                      −
                    </Button>
                    <span className="w-6 text-center tabular-nums" aria-label={`Cantidad de ${l.product.name}`}>
                      {l.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onAdd(l.product.id)}
                      disabled={!canInc}
                      aria-label={`Agregar una unidad de ${l.product.name}`}
                      title={!canInc ? analysis?.additions[l.product.id]?.message ?? 'Sin más stock' : undefined}
                    >
                      +
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.product.id)} aria-label={`Eliminar ${l.product.name}`}>
                      ✕
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {stockIssues.length > 0 && (
        <Alert tone="red" title="Stock insuficiente">
          {stockIssues.map((l) => (
            <p key={l.product.id}>
              {l.product.name}: pediste {l.quantity}, hay {l.product.available}.
            </p>
          ))}
        </Alert>
      )}

      {result && result.unplaced.length > 0 && (
        <Alert tone="red" title="Estos productos no caben">
          <ul className="mt-1 list-disc pl-4">
            {result.unplaced.map((u) => (
              <li key={u.unitId}>
                <strong>{FAILURE_LABELS[u.code]}:</strong> {u.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {recs.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Recomendaciones">
          {recs.map((r, i) => (
            <li key={i}>
              <Alert tone={r.kind === 'success' ? 'green' : r.kind === 'warning' ? 'amber' : r.kind === 'error' ? 'red' : 'blue'}>
                {r.message}
                {r.productIds && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.productIds.map((id) => {
                      const p = products.find((x) => x.id === id);
                      return p ? (
                        <button key={id} className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-sky-300 hover:bg-sky-100" onClick={() => onAdd(id)}>
                          + {p.name}
                        </button>
                      ) : null;
                    })}
                  </span>
                )}
              </Alert>
            </li>
          ))}
        </ul>
      )}

      {result && result.shippingWarnings.length > 0 && (
        <details className="rounded-xl bg-stone-50 p-2.5 text-xs ring-1 ring-stone-200">
          <summary className="cursor-pointer font-medium text-stone-700">Advertencias de envío ({result.shippingWarnings.length})</summary>
          <ul className="mt-1 list-disc pl-4 text-stone-600">
            {result.shippingWarnings.map((w) => (
              <li key={w.productId}>
                <strong>{w.name}:</strong> {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-stone-200 pt-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal productos</span>
          <span className="tabular-nums">{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-stone-600">
          <span>Caja y envío</span>
          <span className="tabular-nums">{formatPrice(box.priceCents)}</span>
        </div>
        <div className="mt-1 flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(subtotalCents + box.priceCents)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {canCheckout ? (
          <Link
            to="/checkout"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
          >
            Continuar al pago
          </Link>
        ) : (
          <Button size="lg" disabled>
            Continuar al pago
          </Button>
        )}
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => confirm('¿Vaciar la caja?') && clear()}>
            Vaciar caja
          </Button>
        )}
      </div>
    </Card>
  );
}
