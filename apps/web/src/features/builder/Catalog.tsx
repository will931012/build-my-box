import { useMemo, useState } from 'react';
import { findSubstitutes, formatPrice, smallFittingProducts, type Product } from '@bmb/shared';
import { Card, cx, EmptyState, Input, Spinner } from '../../components/ui';
import type { BuilderState } from './useBuilder';
import { addStatus, ProductCard } from './ProductCard';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Catalog({ state, onAdd, className }: { state: BuilderState; onAdd: (id: string) => void; className?: string }) {
  const { products, quantities, analysis, pending, colors, box, productsQ } = state;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [onlyFitting, setOnlyFitting] = useState(false);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const ctx = useMemo(
    () => ({ additions: analysis?.additions ?? {}, catalog: products, quantities }),
    [analysis, products, quantities],
  );
  const suggestions = useMemo(() => (analysis && !pending && box ? smallFittingProducts(ctx, 4) : []), [analysis, pending, box, ctx]);

  const visible = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (search && !normalize(`${p.name} ${p.sku} ${p.category}`).includes(normalize(search))) return false;
    if (onlyFitting && !(analysis?.additions[p.id]?.fits && p.available > (quantities[p.id] ?? 0))) return false;
    return true;
  });
  const fittingCount = products.filter((p) => analysis?.additions[p.id]?.fits && p.available > (quantities[p.id] ?? 0)).length;

  return (
    <Card className={cx('flex flex-col p-3 sm:p-4', className)} aria-labelledby="catalog-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="catalog-title" className="text-lg font-semibold">
          Catálogo
        </h2>
        {box && analysis && (
          <span className="text-xs text-stone-600" aria-live="polite">
            {pending ? 'Recalculando…' : `${fittingCount} de ${products.length} productos aún caben`}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <label htmlFor="catalog-search" className="sr-only">
          Buscar productos
        </label>
        <Input id="catalog-search" type="search" placeholder="Buscar arroz, aceite, café…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
          <CategoryChip active={category === null} onClick={() => setCategory(null)}>
            Todas
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </CategoryChip>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" className="accent-brand-600" checked={onlyFitting} onChange={(e) => setOnlyFitting(e.target.checked)} />
          Mostrar solo lo que cabe
        </label>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
          <p className="text-xs font-semibold text-emerald-900">Caben en el espacio restante</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onAdd(p.id)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-emerald-900 ring-1 ring-emerald-300 hover:bg-emerald-100"
                  aria-label={`Agregar ${p.name}`}
                >
                  + {p.name} · {formatPrice(p.priceCents)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex-1">
        {productsQ.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-stone-600">
            <Spinner /> Cargando catálogo…
          </div>
        ) : productsQ.isError ? (
          <EmptyState title="No se pudo cargar el catálogo">{(productsQ.error as Error).message}</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="Sin resultados">Prueba con otra búsqueda o categoría.</EmptyState>
        ) : (
          <ul className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {visible.map((p: Product) => {
              const qty = quantities[p.id] ?? 0;
              const check = analysis?.additions[p.id];
              const status = addStatus(p, qty, check, pending, !!box);
              return (
                <li key={p.id} className="flex">
                  <ProductCard
                    product={p}
                    qty={qty}
                    status={status}
                    check={check}
                    color={colors.get(p.id) ?? '#a8a29e'}
                    substitutes={status === 'nofit' || status === 'out' ? findSubstitutes(p, ctx, 2) : []}
                    onAdd={onAdd}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-full px-3 py-1 text-xs font-medium ring-1 transition',
        active ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300 hover:ring-stone-500',
      )}
    >
      {children}
    </button>
  );
}
