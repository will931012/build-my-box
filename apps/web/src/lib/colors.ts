/**
 * Colores distinguibles por producto.
 * - Los productos que están en la caja reciben colores de una paleta de alto
 *   contraste, en el orden en que se agregaron (así nunca se confunden en 3D).
 * - El resto del catálogo usa un tono repartido con el ángulo dorado.
 */
const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#fabed4', '#469990', '#dcbeff', '#9a6324', '#ffe119', '#800000', '#aaffc3', '#808000',
];

export function productColor(index: number): string {
  const hue = (index * 137.508 + 20) % 360;
  return hslToHex(hue, 60, 62);
}

export function buildColorMap(allIds: string[], priorityIds: string[] = []): Map<string, string> {
  const map = new Map<string, string>();
  priorityIds.forEach((id, i) => {
    const base = PALETTE[i % PALETTE.length];
    map.set(id, i < PALETTE.length ? base : shade(base, i < 2 * PALETTE.length ? 0.65 : 1.25));
  });
  [...allIds].sort().forEach((id, i) => {
    if (!map.has(id)) map.set(id, productColor(i));
  });
  return map;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
