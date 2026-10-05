/** Utilidades de formato en español. */

export function formatWeight(g: number): string {
  if (Math.abs(g) >= 1000) {
    return `${(g / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g).toLocaleString('es')} g`;
}

export function formatPrice(cents: number, currency = 'USD'): string {
  return (cents / 100).toLocaleString('es', { style: 'currency', currency });
}

export function mmToCm(mm: number): string {
  return (mm / 10).toLocaleString('es', { maximumFractionDigits: 1 });
}

export function formatDims(l: number, w: number, h: number): string {
  return `${mmToCm(l)} × ${mmToCm(w)} × ${mmToCm(h)} cm`;
}

export function formatVolumeLiters(mm3: number): string {
  return `${(mm3 / 1_000_000).toLocaleString('es', { maximumFractionDigits: 1 })} L`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatOrderNumber(n: number): string {
  return `BMB-${String(n).padStart(6, '0')}`;
}
