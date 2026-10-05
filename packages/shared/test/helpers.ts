import { expect } from 'vitest';
import type { CartLine, PackableBox, PackableProduct } from '../src/domain';
import { overlaps, usableRegion, usableWeightG } from '../src/packing/geometry';
import type { PackingResult } from '../src/packing/types';
import { SEED_BOXES, SEED_PRODUCTS } from '../src/seedData';

export function product(overrides: Partial<PackableProduct> & { id: string }): PackableProduct {
  return {
    sku: overrides.id.toUpperCase(),
    name: overrides.id,
    lengthMm: 100,
    widthMm: 100,
    heightMm: 100,
    weightG: 500,
    packagingType: 'RIGID',
    allowedOrientations: ['LWH', 'WLH', 'LHW', 'HLW', 'WHL', 'HWL'],
    canSupportWeight: true,
    maxLoadOnTopG: 50_000,
    fragility: 0,
    compressibility: 0,
    ...overrides,
  };
}

export function box(overrides: Partial<PackableBox> = {}): PackableBox {
  return {
    id: 'box',
    name: 'Caja de prueba',
    innerLengthMm: 300,
    innerWidthMm: 300,
    innerHeightMm: 300,
    maxWeightG: 50_000,
    safetyMarginPct: 0,
    ...overrides,
  };
}

export const seedProducts: PackableProduct[] = SEED_PRODUCTS.map((p) => ({ ...p, id: p.sku.toLowerCase() }));
export const seedBoxes: PackableBox[] = SEED_BOXES.map((b, i) => ({ ...b, id: `box-${i}` }));

/** PRNG determinista (mulberry32) para pruebas de propiedades reproducibles. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomCart(seed: number, maxLines = 8, maxQty = 6): CartLine[] {
  const r = rng(seed);
  const n = 1 + Math.floor(r() * maxLines);
  const lines: CartLine[] = [];
  for (let i = 0; i < n; i++) {
    const p = seedProducts[Math.floor(r() * seedProducts.length)];
    lines.push({ product: p, quantity: 1 + Math.floor(r() * maxQty) });
  }
  return lines;
}

/**
 * Verifica todas las invariantes físicas de un resultado de packing:
 * límites, no-colisión, peso, apoyo, orientación permitida y cargas.
 */
export function assertPhysicallyValid(result: PackingResult, b: PackableBox, lines: CartLine[], minSupport = 0.75) {
  const region = usableRegion(b);
  const products = new Map(lines.map((l) => [l.product.id, l.product]));
  const P = result.placements;

  // Peso
  const total = P.reduce((s, p) => s + p.weightG, 0);
  expect(total).toBe(result.totals.weightG);
  expect(total).toBeLessThanOrEqual(usableWeightG(b));

  // Unidades: colocadas + no colocadas = pedidas
  const requested = lines.reduce((s, l) => s + l.quantity, 0);
  expect(P.length + result.unplaced.length).toBe(requested);

  for (const p of P) {
    const prod = products.get(p.productId)!;
    // Límites (dentro de la región útil)
    expect(p.x).toBeGreaterThanOrEqual(region.offset.x);
    expect(p.y).toBeGreaterThanOrEqual(region.offset.y);
    expect(p.z).toBeGreaterThanOrEqual(region.offset.z);
    expect(p.x + p.lengthMm).toBeLessThanOrEqual(region.offset.x + region.lengthMm);
    expect(p.y + p.widthMm).toBeLessThanOrEqual(region.offset.y + region.widthMm);
    expect(p.z + p.heightMm).toBeLessThanOrEqual(region.offset.z + region.heightMm);
    // Orientación permitida y dimensiones consistentes
    expect(prod.allowedOrientations).toContain(p.orientation);
    expect([p.lengthMm, p.widthMm, p.heightMm].sort((a, c) => a - c)).toEqual(
      [prod.lengthMm, prod.widthMm, prod.heightMm].sort((a, c) => a - c),
    );
    // Apoyo
    if (p.z > region.offset.z) {
      expect(p.supportedBy.length).toBeGreaterThan(0);
      expect(p.supportRatio).toBeGreaterThanOrEqual(minSupport - 1e-9);
    }
    // Cargas
    expect(p.loadOnTopG).toBeLessThanOrEqual(p.loadCapacityG + 1);
    for (const sid of p.supportedBy) {
      const s = P.find((q) => q.unitId === sid)!;
      const sp = products.get(s.productId)!;
      expect(sp.canSupportWeight).toBe(true);
      expect(s.z + s.heightMm).toBe(p.z);
    }
  }

  // No colisiones
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) {
      const a = P[i], c = P[j];
      const hit = overlaps(
        { x: a.x, y: a.y, z: a.z, dx: a.lengthMm, dy: a.widthMm, dz: a.heightMm },
        { x: c.x, y: c.y, z: c.z, dx: c.lengthMm, dy: c.widthMm, dz: c.heightMm },
      );
      if (hit) throw new Error(`Colisión entre ${a.unitId} y ${c.unitId}`);
    }
  }
}
