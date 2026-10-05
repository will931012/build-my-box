import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CartLine, Product } from '@bmb/shared';
import { api } from '../../api/client';
import { buildColorMap } from '../../lib/colors';
import { usePackingAnalysis } from '../../packing/usePackingAnalysis';
import { useCart } from '../../store/cart';

/** Estado derivado del constructor de caja: catálogo, caja elegida, líneas y análisis del motor. */
export function useBuilder() {
  const productsQ = useQuery({ queryKey: ['products'], queryFn: api.products });
  const boxesQ = useQuery({ queryKey: ['boxes'], queryFn: api.boxes });
  const { boxId, quantities } = useCart();

  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const boxes = useMemo(() => boxesQ.data ?? [], [boxesQ.data]);
  const box = boxes.find((b) => b.id === boxId);

  const lines: CartLine<Product>[] = useMemo(
    () =>
      Object.entries(quantities)
        .map(([id, quantity]) => ({ product: products.find((p) => p.id === id)!, quantity }))
        .filter((l) => l.product && l.quantity > 0),
    [quantities, products],
  );

  const cartIds = Object.keys(quantities).join(',');
  const colors = useMemo(() => buildColorMap(products.map((p) => p.id), cartIds ? cartIds.split(',') : []), [products, cartIds]);
  const { analysis, pending, error } = usePackingAnalysis(box, lines, products, productsQ.dataUpdatedAt);

  const stockIssues = lines.filter((l) => l.quantity > l.product.available);
  const subtotalCents = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);

  return {
    productsQ,
    boxesQ,
    products,
    boxes,
    box,
    lines,
    quantities,
    colors,
    analysis,
    pending,
    engineError: error,
    stockIssues,
    subtotalCents,
  };
}

export type BuilderState = ReturnType<typeof useBuilder>;
