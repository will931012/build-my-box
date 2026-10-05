import type { Product } from './domain';
import { formatWeight } from './format';
import type { AdditionCheck, PackingResult } from './packing/types';

export type RecommendationKind = 'info' | 'warning' | 'success' | 'error';

export interface Recommendation {
  kind: RecommendationKind;
  message: string;
  /** Productos relacionados con la recomendación (p. ej. sugerencias que caben). */
  productIds?: string[];
}

export interface CatalogFitContext {
  result: PackingResult;
  additions: Record<string, AdditionCheck>;
  catalog: Product[];
  quantities: Record<string, number>;
}

const volume = (p: Pick<Product, 'lengthMm' | 'widthMm' | 'heightMm'>) => p.lengthMm * p.widthMm * p.heightMm;

/** Productos del catálogo que se pueden agregar ahora mismo (caben y hay stock). */
export function addableProducts({ additions, catalog, quantities }: Omit<CatalogFitContext, 'result'>): Product[] {
  return catalog.filter((p) => p.active && p.available > (quantities[p.id] ?? 0) && additions[p.id]?.fits);
}

/** Productos pequeños que sí caben, del más pequeño al más grande. */
export function smallFittingProducts(ctx: Omit<CatalogFitContext, 'result'>, limit = 4): Product[] {
  return addableProducts(ctx)
    .sort((a, b) => volume(a) - volume(b) || a.weightG - b.weightG)
    .slice(0, limit);
}

/** Sustitutos de un producto: misma categoría, caben y tienen stock. */
export function findSubstitutes(product: Product, ctx: Omit<CatalogFitContext, 'result'>, limit = 3): Product[] {
  return addableProducts(ctx)
    .filter((p) => p.id !== product.id && p.category === product.category)
    .sort(
      (a, b) =>
        Math.abs(a.priceCents - product.priceCents) - Math.abs(b.priceCents - product.priceCents) ||
        Math.abs(volume(a) - volume(product)) - Math.abs(volume(b) - volume(product)),
    )
    .slice(0, limit);
}

export function buildRecommendations(ctx: CatalogFitContext): Recommendation[] {
  const { result } = ctx;
  const recs: Recommendation[] = [];
  const t = result.totals;
  const addable = addableProducts(ctx);

  if (result.status === 'EMPTY') {
    recs.push({
      kind: 'info',
      message: 'Tu caja está vacía. Empieza por productos pesados y resistentes (arroz, aceite, latas): irán al fondo.',
    });
    return recs;
  }

  if (result.status !== 'FITS') {
    recs.push({
      kind: 'error',
      message: 'El contenido actual no cabe en esta caja. Quita productos o elige una caja más grande para continuar.',
    });
    return recs;
  }

  const remainingWeight = t.usableWeightG - t.weightG;
  if (t.weightUtilization >= 0.85) {
    recs.push({
      kind: 'warning',
      message: `Evita artículos pesados: estás cerca del límite (quedan ${formatWeight(remainingWeight)}).`,
    });
  }

  if (addable.length === 0) {
    recs.push({ kind: 'success', message: 'Tu caja está llena y lista para finalizar.' });
    return recs;
  }

  const small = smallFittingProducts(ctx, 3);
  const nonFitting = ctx.catalog.filter((p) => p.active && p.available > (ctx.quantities[p.id] ?? 0) && !ctx.additions[p.id]?.fits);
  if (nonFitting.length > 0 && small.length > 0) {
    recs.push({
      kind: 'info',
      message: `Puedes agregar productos pequeños: ${small.map((p) => p.name).join(', ')}.`,
      productIds: small.map((p) => p.id),
    });
  }

  if (t.weightUtilization >= 0.6 || t.volumeUtilization >= 0.5 || nonFitting.length > 0) {
    recs.push({ kind: 'success', message: 'Tu caja está lista para finalizar. También puedes seguir agregando.' });
  } else {
    recs.push({ kind: 'info', message: 'Todavía queda bastante espacio: aprovecha el costo del envío.' });
  }
  return recs;
}
