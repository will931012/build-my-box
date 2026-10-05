import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { formatWeight, STATUS_LABELS } from '@bmb/shared';
import { Badge, cx, Spinner } from '../../components/ui';
import type { BuilderState } from './useBuilder';

const MiniBoxViewer = lazy(() => import('../../components/BoxViewer3D').then((m) => ({ default: m.MiniBoxViewer })));

/**
 * Barra flotante para móvil y tablet: cuando el visor grande sale de la pantalla
 * (el cliente está bajando por el catálogo), muestra una cajita 3D en vivo con el
 * estado, el peso y el último aviso ("agregado" / "no cabe").
 */
export function MiniBoxBar({
  state,
  announcement,
  onShowBox,
}: {
  state: BuilderState;
  announcement: string;
  onShowBox: () => void;
}) {
  const { box, analysis, pending, lines, colors, stockIssues } = state;
  if (!box || !analysis) return null;
  const { result } = analysis;
  const t = result.totals;
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  const weightRatio = t.usableWeightG > 0 ? t.weightG / t.usableWeightG : 0;
  const canCheckout = !pending && result.status === 'FITS' && stockIssues.length === 0 && lines.length > 0;
  const positive = announcement.includes('agregado');

  return (
    <div className="no-print fixed inset-x-2 bottom-2 z-30 animate-slide-up pb-[env(safe-area-inset-bottom)] xl:hidden" role="region" aria-label="Tu caja (vista rápida)">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-white/95 p-2 shadow-xl ring-1 ring-stone-200 backdrop-blur">
        <button
          onClick={onShowBox}
          className="relative shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600"
          aria-label="Ver la caja en grande"
        >
          <Suspense fallback={<div className="flex size-20 items-center justify-center rounded-xl bg-stone-100"><Spinner /></div>}>
            <MiniBoxViewer box={box} result={result} colors={colors} className="size-20 sm:size-24" />
          </Suspense>
          <span className="absolute -right-1 -top-1 rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{units}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {pending ? (
              <Badge>
                <Spinner className="size-3" label="Recalculando" /> Recalculando
              </Badge>
            ) : (
              <Badge tone={result.status === 'FITS' ? (weightRatio >= 0.85 ? 'amber' : 'green') : result.status === 'EMPTY' ? 'neutral' : 'red'}>
                {STATUS_LABELS[result.status]}
              </Badge>
            )}
            <span className="truncate text-xs text-stone-600">
              {formatWeight(t.weightG)} / {formatWeight(t.usableWeightG)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
            <div
              className={cx('h-full rounded-full transition-[width] duration-500', weightRatio >= 0.85 ? 'bg-amber-500' : 'bg-brand-500')}
              style={{ width: `${Math.min(100, Math.round(weightRatio * 100))}%` }}
            />
          </div>
          <p className={cx('mt-1 line-clamp-2 text-xs leading-4', announcement ? (positive ? 'text-emerald-700' : 'text-amber-800') : 'text-stone-500')} aria-live="polite">
            {announcement || 'Toca la caja para verla en grande.'}
          </p>
        </div>

        {canCheckout && (
          <Link to="/checkout" className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Pagar
          </Link>
        )}
      </div>
    </div>
  );
}
