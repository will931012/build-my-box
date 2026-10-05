import { describe, expect, it } from 'vitest';
import { checkAdditions, packCart, suggestFill, tierOf, usableRegion, usableWeightG } from '../src/packing';
import { assertPhysicallyValid, box, product, randomCart, seedBoxes, seedProducts } from './helpers';

const UPRIGHT = ['LWH', 'WLH'] as const;

describe('caja vacía y casos básicos', () => {
  it('una caja sin productos queda en estado EMPTY', () => {
    const r = packCart(box(), []);
    expect(r.status).toBe('EMPTY');
    expect(r.placements).toHaveLength(0);
    expect(r.totals.weightG).toBe(0);
  });

  it('coloca un producto en la esquina del piso', () => {
    const r = packCart(box(), [{ product: product({ id: 'a' }), quantity: 1 }]);
    expect(r.status).toBe('FITS');
    expect(r.placements[0]).toMatchObject({ x: 0, y: 0, z: 0, layer: 1, supportRatio: 1 });
  });

  it('ignora cantidades 0 y fusiona líneas repetidas del mismo producto', () => {
    const a = product({ id: 'a' });
    const r = packCart(box(), [
      { product: a, quantity: 2 },
      { product: a, quantity: 1 },
      { product: product({ id: 'b' }), quantity: 0 },
    ]);
    expect(r.placements.map((p) => p.unitId).sort()).toEqual(['a#1', 'a#2', 'a#3']);
  });

  it('llena exactamente una caja con cubos que caben justo (27 cubos de 10 cm)', () => {
    const lines = [{ product: product({ id: 'cubo', weightG: 100 }), quantity: 27 }];
    const r = packCart(box(), lines);
    expect(r.status).toBe('FITS');
    expect(r.totals.volumeUtilization).toBeCloseTo(1, 5);
    assertPhysicallyValid(r, box(), lines);
    // y el 28 ya no cabe
    const r2 = packCart(box(), [{ product: lines[0].product, quantity: 28 }]);
    expect(r2.status).toBe('DOES_NOT_FIT');
    expect(r2.unplaced[0].code).toBe('NO_SPACE');
  });
});

describe('límites de la caja y margen de seguridad', () => {
  it('reserva el margen en volumen (repartido en 3 ejes) y en peso', () => {
    const b = box({ innerLengthMm: 500, innerWidthMm: 400, innerHeightMm: 400, maxWeightG: 25_000, safetyMarginPct: 10 });
    const r = usableRegion(b);
    const ratio = (r.lengthMm * r.widthMm * r.heightMm) / (500 * 400 * 400);
    expect(ratio).toBeGreaterThan(0.89);
    expect(ratio).toBeLessThanOrEqual(0.9);
    expect(usableWeightG(b)).toBe(22_500);
    // centrado en planta, apoyado en el piso
    expect(r.offset.x).toBeCloseTo((500 - r.lengthMm) / 2);
    expect(r.offset.z).toBe(0);
  });

  it('rechaza un producto más grande que la caja en cualquier orientación', () => {
    const r = packCart(box(), [{ product: product({ id: 'big', lengthMm: 400 }), quantity: 1 }]);
    expect(r.status).toBe('DOES_NOT_FIT');
    expect(r.unplaced[0].code).toBe('TOO_LARGE');
  });

  it('el margen de seguridad impide meter algo que cabría justo en las dimensiones internas', () => {
    const p = product({ id: 'justo', lengthMm: 300, widthMm: 300, heightMm: 300 });
    expect(packCart(box({ safetyMarginPct: 0 }), [{ product: p, quantity: 1 }]).status).toBe('FITS');
    expect(packCart(box({ safetyMarginPct: 10 }), [{ product: p, quantity: 1 }]).unplaced[0].code).toBe('TOO_LARGE');
  });
});

describe('colisiones y geometría (no solo volumen)', () => {
  it('dos cubos de 60 cm no caben en una caja de 1 m³ aunque el volumen sobre', () => {
    const b = box({ innerLengthMm: 1000, innerWidthMm: 1000, innerHeightMm: 1000 });
    const cube = product({ id: 'cubo60', lengthMm: 600, widthMm: 600, heightMm: 600, weightG: 1000 });
    const r = packCart(b, [{ product: cube, quantity: 2 }]);
    expect(r.totals.itemsVolumeMm3 * 2).toBeLessThan(1000 ** 3); // el volumen "alcanzaría"
    expect(r.placements).toHaveLength(1);
    expect(r.unplaced[0].code).toBe('NO_SPACE');
  });

  it('ningún par de productos se superpone en carritos aleatorios', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = seedBoxes[seed % seedBoxes.length];
      const lines = randomCart(seed);
      const r = packCart(b, lines);
      assertPhysicallyValid(r, b, lines);
    }
  });
});

describe('sobrepeso', () => {
  it('rechaza la unidad que supera el peso útil', () => {
    const b = box({ maxWeightG: 10_000, safetyMarginPct: 10 }); // útil: 9 kg
    const r = packCart(b, [{ product: product({ id: 'kilo', weightG: 1000, lengthMm: 50, widthMm: 50, heightMm: 50 }), quantity: 10 }]);
    expect(r.status).toBe('EXCEEDS_WEIGHT');
    expect(r.placements).toHaveLength(9);
    expect(r.unplaced).toHaveLength(1);
    expect(r.unplaced[0].code).toBe('EXCEEDS_WEIGHT');
    expect(r.totals.weightG).toBe(9000);
  });

  it('checkAdditions informa EXCEEDS_WEIGHT antes de intentar colocar', () => {
    const b = box({ maxWeightG: 2000, safetyMarginPct: 0 });
    const light = product({ id: 'light', weightG: 1500 });
    const heavy = product({ id: 'heavy', weightG: 600 });
    const res = checkAdditions(b, [{ product: light, quantity: 1 }], [{ product: heavy }, { product: product({ id: 'ok', weightG: 400 }) }]);
    expect(res.heavy).toMatchObject({ fits: false, code: 'EXCEEDS_WEIGHT' });
    expect(res.ok.fits).toBe(true);
  });
});

describe('orientación', () => {
  const tall = { lengthMm: 100, widthMm: 100, heightMm: 350 };

  it('un producto "este lado arriba" más alto que la caja no se acuesta', () => {
    const r = packCart(box({ innerLengthMm: 400 }), [{ product: product({ id: 'botella', ...tall, allowedOrientations: [...UPRIGHT] }), quantity: 1 }]);
    expect(r.unplaced[0].code).toBe('ORIENTATION_NOT_ALLOWED');
  });

  it('si se permite acostarlo, se coloca acostado', () => {
    const r = packCart(box({ innerLengthMm: 400 }), [{ product: product({ id: 'tubo', ...tall }), quantity: 1 }]);
    expect(r.status).toBe('FITS');
    expect(r.placements[0].heightMm).toBe(100);
    expect(['LHW', 'HLW', 'WHL', 'HWL']).toContain(r.placements[0].orientation);
  });

  it('los productos verticales siempre conservan su alto en el eje z', () => {
    const lines = seedProducts.filter((p) => p.allowedOrientations.every((o) => o === 'LWH' || o === 'WLH')).map((p) => ({ product: p, quantity: 2 }));
    const b = seedBoxes[2];
    const r = packCart(b, lines);
    for (const pl of r.placements) {
      const p = lines.find((l) => l.product.id === pl.productId)!.product;
      expect(pl.heightMm).toBe(p.heightMm);
    }
    assertPhysicallyValid(r, b, lines);
  });

  it('prefiere la orientación más estable (más baja) cuando hay opción', () => {
    const r = packCart(box(), [{ product: product({ id: 'libro', lengthMm: 200, widthMm: 50, heightMm: 150 }), quantity: 1 }]);
    expect(r.placements[0].heightMm).toBe(50);
  });
});

describe('frágiles, blandos y carga encima', () => {
  // Caja "columna": solo cabe un producto por nivel, así se fuerza el apilado.
  const column = box({ innerLengthMm: 100, innerWidthMm: 100, innerHeightMm: 1000 });
  const cube = { lengthMm: 100, widthMm: 100, heightMm: 100 };

  it('clasifica en niveles: rígido (0), delicado (1), frágil/blando (2)', () => {
    expect(tierOf(product({ id: 'r' }))).toBe(0);
    expect(tierOf(product({ id: 'g', fragility: 2 }))).toBe(1);
    expect(tierOf(product({ id: 'v', canSupportWeight: false }))).toBe(2);
    expect(tierOf(product({ id: 'p', compressibility: 3 }))).toBe(2);
  });

  it('el frágil va encima del pesado aunque se agregue primero', () => {
    const fragile = product({ id: 'vidrio', ...cube, weightG: 700, canSupportWeight: false, maxLoadOnTopG: 0, fragility: 3 });
    const heavy = product({ id: 'arroz', ...cube, weightG: 2000 });
    const r = packCart(column, [
      { product: fragile, quantity: 1 },
      { product: heavy, quantity: 1 },
    ]);
    expect(r.status).toBe('FITS');
    const f = r.placements.find((p) => p.productId === 'vidrio')!;
    const h = r.placements.find((p) => p.productId === 'arroz')!;
    expect(h.z).toBe(0);
    expect(f.z).toBe(100);
    expect(f.supportedBy).toEqual(['arroz#1']);
  });

  it('nada se apoya sobre un producto que no admite peso', () => {
    const fragile = product({ id: 'vidrio', ...cube, weightG: 300, canSupportWeight: false, maxLoadOnTopG: 0, fragility: 3 });
    const r = packCart(column, [{ product: fragile, quantity: 2 }]);
    expect(r.placements).toHaveLength(1);
    expect(r.unplaced[0].code).toBe('FRAGILITY_RULE');
  });

  it('un producto pesado no se apoya sobre uno delicado (frágil/blando)', () => {
    const delicate = product({ id: 'galletas', ...cube, weightG: 400, fragility: 2, maxLoadOnTopG: 5000 });
    const heavyFragile = product({ id: 'frasco', ...cube, weightG: 800, fragility: 3, canSupportWeight: false, maxLoadOnTopG: 0 });
    const r = packCart(column, [
      { product: delicate, quantity: 1 },
      { product: heavyFragile, quantity: 1 },
    ]);
    expect(r.placements.map((p) => p.productId)).toEqual(['galletas']);
    expect(r.unplaced[0]).toMatchObject({ productId: 'frasco', code: 'FRAGILITY_RULE' });
  });

  it('respeta la carga acumulada máxima propagada hacia abajo', () => {
    const base = product({ id: 'base', ...cube, weightG: 1000, maxLoadOnTopG: 1000 });
    // Ningún orden de apilado es válido para 4 unidades: abajo siempre habría >1 kg.
    const top = product({ id: 'top', ...cube, weightG: 400, maxLoadOnTopG: 500 });
    const r = packCart(column, [
      { product: base, quantity: 1 },
      { product: top, quantity: 3 },
    ]);
    expect(r.placements).toHaveLength(3); // base + 2 encima (800 g ≤ 1000 g)
    expect(r.placements.find((p) => p.unitId === 'base#1')!.loadOnTopG).toBe(800);
    expect(r.unplaced).toHaveLength(1);
    expect(r.unplaced[0].code).toBe('FRAGILITY_RULE');
  });

  it('con datos reales, ningún frágil/blando queda debajo de algo pesado', () => {
    for (let seed = 100; seed < 140; seed++) {
      const b = seedBoxes[seed % seedBoxes.length];
      const lines = randomCart(seed, 10, 5);
      const r = packCart(b, lines);
      const byId = new Map(r.placements.map((p) => [p.unitId, p]));
      for (const p of r.placements) {
        for (const sid of p.supportedBy) {
          const s = byId.get(sid)!;
          const sp = seedProducts.find((x) => x.id === s.productId)!;
          expect(sp.canSupportWeight).toBe(true);
          if (sp.fragility >= 2 || sp.compressibility >= 2) expect(p.weightG).toBeLessThanOrEqual(500);
        }
      }
    }
  });
});

describe('estabilidad', () => {
  it('no deja productos flotando ni con apoyo insuficiente', () => {
    const b = box({ innerLengthMm: 200, innerWidthMm: 100, innerHeightMm: 200 });
    const small = product({ id: 'pequeno', lengthMm: 100, widthMm: 100, heightMm: 50, weightG: 2000 });
    const plank = product({
      id: 'tabla', lengthMm: 200, widthMm: 100, heightMm: 50, weightG: 300, allowedOrientations: ['LWH'],
      canSupportWeight: false, maxLoadOnTopG: 0,
    });
    // La tabla no admite peso (va al final) y encima del pequeño solo tendría 50% de apoyo.
    const r = packCart(b, [
      { product: small, quantity: 1 },
      { product: plank, quantity: 1 },
    ]);
    expect(r.unplaced[0]).toMatchObject({ productId: 'tabla', code: 'INSUFFICIENT_SUPPORT' });
  });

  it('acepta apoyo compartido entre varios productos de la misma altura', () => {
    const b = box({ innerLengthMm: 200, innerWidthMm: 100, innerHeightMm: 200 });
    const small = product({ id: 'pequeno', lengthMm: 100, widthMm: 100, heightMm: 50, weightG: 2000 });
    const plank = product({ id: 'tabla', lengthMm: 200, widthMm: 100, heightMm: 50, weightG: 300, allowedOrientations: ['LWH'] });
    const r = packCart(b, [
      { product: small, quantity: 2 },
      { product: plank, quantity: 1 },
    ]);
    expect(r.status).toBe('FITS');
    const t = r.placements.find((p) => p.productId === 'tabla')!;
    expect(t.z).toBe(50);
    expect(t.supportedBy.sort()).toEqual(['pequeno#1', 'pequeno#2']);
    expect(t.layer).toBe(2);
  });
});

describe('determinismo y evaluación incremental', () => {
  it('el mismo carrito produce siempre el mismo acomodo, sin importar el orden de las líneas', () => {
    const lines = randomCart(7, 8, 4);
    const a = packCart(seedBoxes[0], lines);
    const b = packCart(seedBoxes[0], [...lines].reverse());
    expect(b.placements).toEqual(a.placements);
  });

  it('checkAdditions coincide con un repack completo del carrito extendido', () => {
    for (let seed = 200; seed < 230; seed++) {
      const b = seedBoxes[seed % seedBoxes.length];
      const lines = randomCart(seed, 6, 5);
      if (packCart(b, lines).status !== 'FITS') continue;
      const checks = checkAdditions(b, lines, seedProducts.map((p) => ({ product: p })));
      for (const p of seedProducts) {
        const full = packCart(b, [...lines, { product: p, quantity: 1 }]);
        expect(checks[p.id].fits, `${p.id} seed ${seed}`).toBe(full.status === 'FITS');
      }
    }
  });

  it('explica en español por qué un producto no cabe', () => {
    const b = box({ maxWeightG: 1000 });
    const res = checkAdditions(b, [], [{ product: product({ id: 'pesado', name: 'Saco de arroz', weightG: 5000 }) }]);
    expect(res.pesado.fits).toBe(false);
    expect(res.pesado.message).toMatch(/Saco de arroz pesa 5 kg/);
  });
});

describe('sugerencia de llenado', () => {
  it('propone productos que caben sin violar ninguna regla', () => {
    const b = seedBoxes[1];
    const catalog = seedProducts.map((p) => ({ product: p, available: 5 }));
    const s = suggestFill(b, [], catalog, { maxUnits: 25 });
    expect(s.added.length).toBeGreaterThan(0);
    expect(s.result.status).toBe('FITS');
    assertPhysicallyValid(
      s.result,
      b,
      s.added.map((a) => ({ product: a.product, quantity: a.quantity })),
    );
  });
});
