import type { Box, OrderStatus } from './domain';
import { formatDims, formatWeight, mmToCm } from './format';
import type { PackingResult, Placement } from './packing/types';

export interface OrderItemDto {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  weightG: number;
}

export interface RecipientDto {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  notes: string;
}

export interface OrderDto {
  id: string;
  number: number;
  numberLabel: string;
  status: OrderStatus;
  box: Box;
  recipient: RecipientDto;
  items: OrderItemDto[];
  subtotalCents: number;
  boxPriceCents: number;
  totalCents: number;
  totalWeightG: number;
  packingPlan: PackingResult;
  customsDeclaration: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  fulfilledAt: string | null;
}

/** Agrupa las colocaciones por capa (nivel de apilamiento). */
export function placementsByLayer(result: PackingResult): { layer: number; placements: Placement[] }[] {
  const map = new Map<number, Placement[]>();
  for (const p of result.placements) map.set(p.layer, [...(map.get(p.layer) ?? []), p]);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([layer, placements]) => ({ layer, placements }));
}

/** Instrucciones de empaque legibles, derivadas del plano del motor. */
export function packingInstructions(result: PackingResult): string[] {
  const steps: string[] = [
    'Arma la caja y refuerza el fondo con cinta en "H".',
    'Coloca los productos siguiendo el orden de capas del plano (de abajo hacia arriba).',
  ];
  for (const { layer, placements } of placementsByLayer(result)) {
    const counts = new Map<string, number>();
    for (const p of placements) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
    const list = [...counts].map(([n, c]) => `${c} × ${n}`).join(', ');
    steps.push(`Capa ${layer}${layer === 1 ? ' (fondo)' : ''}: ${list}.`);
  }
  const P = result.placements;
  if (P.some((p) => p.loadCapacityG === 0)) {
    steps.push('Los productos marcados "sin peso encima" deben quedar arriba y sin carga.');
  }
  for (const r of result.reviewReasons) steps.push(r);
  for (const w of result.shippingWarnings) steps.push(`${w.name}: ${w.message}`);
  steps.push('Rellena los huecos con papel o material de relleno para que nada se desplace.');
  steps.push('Verifica el peso final en báscula antes de cerrar y sellar la caja.');
  return steps;
}

/**
 * Borrador editable de la declaración de contenido. NO garantiza cumplimiento
 * aduanal: el personal debe revisarla según las reglas vigentes del destino.
 */
export function draftCustomsDeclaration(items: OrderItemDto[], box: Pick<Box, 'innerLengthMm' | 'innerWidthMm' | 'innerHeightMm'>): string {
  const lines = items.map(
    (i) => `- ${i.quantity} × ${i.name} (SKU ${i.sku}) — ${formatWeight(i.weightG * i.quantity)} — valor ${(i.unitPriceCents * i.quantity / 100).toFixed(2)} USD`,
  );
  const total = items.reduce((s, i) => s + i.weightG * i.quantity, 0);
  return [
    'DECLARACIÓN DE CONTENIDO (BORRADOR — revisar antes de enviar)',
    `Caja: ${formatDims(box.innerLengthMm, box.innerWidthMm, box.innerHeightMm)} (interior)`,
    'Contenido:',
    ...lines,
    `Peso neto estimado del contenido: ${formatWeight(total)}`,
    'Tipo de envío: [completar]   Uso: [completar]',
    'Nota: verificar restricciones vigentes de importación del país de destino.',
  ].join('\n');
}

export function describePosition(p: Placement): string {
  return `x ${mmToCm(p.x)} · y ${mmToCm(p.y)} · z ${mmToCm(p.z)} cm`;
}
