import { ORIENTATIONS, type Orientation, type PackableBox, type PackableProduct } from '../domain';
import type { UsableRegion } from './types';

export interface Dims {
  dx: number;
  dy: number;
  dz: number;
}

export interface Aabb {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

/** Dimensiones resultantes (x, y, z) de un producto en una orientación dada. */
export function orientedDims(p: Pick<PackableProduct, 'lengthMm' | 'widthMm' | 'heightMm'>, o: Orientation): Dims {
  const v = { L: p.lengthMm, W: p.widthMm, H: p.heightMm } as const;
  return { dx: v[o[0] as 'L'], dy: v[o[1] as 'L'], dz: v[o[2] as 'L'] };
}

/**
 * Orientaciones permitidas y geométricamente distintas (si dos orientaciones producen
 * las mismas dimensiones, p. ej. un cubo, solo se conserva la primera).
 */
export function distinctAllowedOrientations(p: PackableProduct): { orientation: Orientation; dims: Dims }[] {
  const allowed = p.allowedOrientations.length > 0 ? p.allowedOrientations : ['LWH' as Orientation];
  const seen = new Set<string>();
  const out: { orientation: Orientation; dims: Dims }[] = [];
  for (const o of ORIENTATIONS) {
    if (!allowed.includes(o)) continue;
    const dims = orientedDims(p, o);
    const key = `${dims.dx}x${dims.dy}x${dims.dz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ orientation: o, dims });
  }
  return out;
}

export function fitsInRegion(d: Dims, r: UsableRegion): boolean {
  return d.dx <= r.lengthMm && d.dy <= r.widthMm && d.dz <= r.heightMm;
}

/** Intersección estricta de volúmenes (tocarse en una cara no es colisión). */
export function overlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.x < b.x + b.dx &&
    b.x < a.x + a.dx &&
    a.y < b.y + b.dy &&
    b.y < a.y + a.dy &&
    a.z < b.z + b.dz &&
    b.z < a.z + a.dz
  );
}

/** Área de intersección de las proyecciones en el plano XY. */
export function footprintOverlapArea(a: Aabb, b: Aabb): number {
  const w = Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x);
  const d = Math.min(a.y + a.dy, b.y + b.dy) - Math.max(a.y, b.y);
  return w > 0 && d > 0 ? w * d : 0;
}

/**
 * Región útil: se reserva `safetyMarginPct` del volumen como holgura (relleno, cartón
 * protector, tolerancias), repartida uniformemente en las tres dimensiones y centrada.
 */
export function usableRegion(box: PackableBox): UsableRegion {
  const margin = clampMargin(box.safetyMarginPct);
  const factor = Math.cbrt(1 - margin / 100);
  const lengthMm = Math.floor(box.innerLengthMm * factor);
  const widthMm = Math.floor(box.innerWidthMm * factor);
  const heightMm = Math.floor(box.innerHeightMm * factor);
  return {
    offset: {
      x: (box.innerLengthMm - lengthMm) / 2,
      y: (box.innerWidthMm - widthMm) / 2,
      z: 0, // la carga se apoya en el piso; la holgura vertical queda arriba
    },
    lengthMm,
    widthMm,
    heightMm,
  };
}

export function usableWeightG(box: PackableBox): number {
  return Math.floor(box.maxWeightG * (1 - clampMargin(box.safetyMarginPct) / 100));
}

function clampMargin(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(50, Math.max(0, pct));
}
