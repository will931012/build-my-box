import type { CartLine, PackableBox, PackableProduct } from '../domain';
import { extremePointsEngine } from './extremePoints';
import type { AdditionCheck, PackingEngine, PackingOptions, PackingResult } from './types';

export * from './types';
export * from './geometry';
export * from './messages';
export { extremePointsEngine, tierOf, EXTREME_POINTS_ALGORITHM_ID } from './extremePoints';

/** Motor activo. Para cambiar de algoritmo basta con implementar `PackingEngine` y apuntar aquí. */
export const defaultPackingEngine: PackingEngine = extremePointsEngine;

export function packCart(
  box: PackableBox,
  lines: CartLine[],
  options?: Partial<PackingOptions>,
  engine: PackingEngine = defaultPackingEngine,
): PackingResult {
  return engine.pack({ box, lines, options });
}

export function checkAdditions(
  box: PackableBox,
  lines: CartLine[],
  candidates: { product: PackableProduct; quantity?: number }[],
  options?: Partial<PackingOptions>,
  engine: PackingEngine = defaultPackingEngine,
): Record<string, AdditionCheck> {
  return engine.checkAdditions({ box, lines, options }, candidates);
}

export interface FillSuggestion {
  added: { product: PackableProduct; quantity: number }[];
  result: PackingResult;
}

/**
 * Sugiere cómo completar la caja de forma voraz: en cada paso agrega una unidad
 * del producto disponible más voluminoso que todavía cabe (según el motor).
 * No modifica nada: solo devuelve una propuesta para que el cliente decida.
 */
export function suggestFill(
  box: PackableBox,
  lines: CartLine[],
  catalog: { product: PackableProduct; available: number }[],
  opts: { maxUnits?: number; options?: Partial<PackingOptions>; engine?: PackingEngine } = {},
): FillSuggestion {
  const engine = opts.engine ?? defaultPackingEngine;
  const maxUnits = opts.maxUnits ?? 40;
  const current = new Map<string, CartLine>();
  for (const l of lines) current.set(l.product.id, { product: l.product, quantity: l.quantity });
  const added = new Map<string, { product: PackableProduct; quantity: number }>();

  const volume = (p: PackableProduct) => p.lengthMm * p.widthMm * p.heightMm;
  for (let step = 0; step < maxUnits; step++) {
    const eligible = catalog.filter(({ product, available }) => available > (current.get(product.id)?.quantity ?? 0));
    if (eligible.length === 0) break;
    const checks = engine.checkAdditions({ box, lines: [...current.values()], options: opts.options }, eligible);
    const fitting = eligible
      .filter(({ product }) => checks[product.id]?.fits)
      .sort((a, b) => volume(b.product) - volume(a.product) || a.product.sku.localeCompare(b.product.sku));
    const pick = fitting[0]?.product;
    if (!pick) break;
    const line = current.get(pick.id);
    current.set(pick.id, { product: pick, quantity: (line?.quantity ?? 0) + 1 });
    const a = added.get(pick.id);
    added.set(pick.id, { product: pick, quantity: (a?.quantity ?? 0) + 1 });
  }
  return { added: [...added.values()], result: engine.pack({ box, lines: [...current.values()], options: opts.options }) };
}
