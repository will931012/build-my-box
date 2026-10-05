import type { FailureCode, PackingStatus, PlacementTier } from './types';
import { formatWeight } from '../format';

export const FAILURE_LABELS: Record<FailureCode, string> = {
  EXCEEDS_WEIGHT: 'Excede el peso',
  TOO_LARGE: 'Demasiado grande',
  ORIENTATION_NOT_ALLOWED: 'Orientación no permitida',
  NO_SPACE: 'Sin espacio físico',
  INSUFFICIENT_SUPPORT: 'Sin apoyo estable',
  FRAGILITY_RULE: 'Regla de fragilidad',
  INVALID_PRODUCT: 'Datos inválidos',
};

export const STATUS_LABELS: Record<PackingStatus, string> = {
  EMPTY: 'Caja vacía',
  FITS: 'Todo cabe',
  DOES_NOT_FIT: 'No cabe',
  EXCEEDS_WEIGHT: 'Excede peso',
};

export function failureMessage(
  code: FailureCode,
  ctx: { name: string; weightG?: number; remainingWeightG?: number },
): string {
  switch (code) {
    case 'EXCEEDS_WEIGHT':
      return `${ctx.name} pesa ${formatWeight(ctx.weightG ?? 0)} y solo quedan ${formatWeight(
        Math.max(0, ctx.remainingWeightG ?? 0),
      )} de peso disponible.`;
    case 'TOO_LARGE':
      return `${ctx.name} es más grande que el espacio interior útil de la caja en cualquier orientación.`;
    case 'ORIENTATION_NOT_ALLOWED':
      return `${ctx.name} solo cabría acostado o girado, pero debe viajar en su orientación permitida (p. ej. "este lado arriba").`;
    case 'NO_SPACE':
      return `No queda un hueco físico libre con la forma de ${ctx.name}, aunque el volumen total parezca suficiente.`;
    case 'INSUFFICIENT_SUPPORT':
      return `Solo hay huecos donde ${ctx.name} quedaría sin apoyo suficiente debajo (flotando o inestable).`;
    case 'FRAGILITY_RULE':
      return `${ctx.name} solo podría ir encima de productos frágiles o blandos que no soportan su peso.`;
    case 'INVALID_PRODUCT':
      return `${ctx.name} tiene dimensiones o peso inválidos; revisa la ficha del producto.`;
  }
}

export function tierReason(tier: PlacementTier): string {
  switch (tier) {
    case 0:
      return 'Producto rígido y resistente: se coloca primero para formar una base estable';
    case 1:
      return 'Producto semirresistente: se coloca después de la base';
    case 2:
      return 'Producto frágil o blando: se coloca al final, en la parte superior y sin peso encima';
  }
}
