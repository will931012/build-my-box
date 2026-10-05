/**
 * Motor de packing 3D determinista basado en "extreme points"
 * (Crainic, Perboli & Tadei, 2008) con reglas físicas adicionales:
 *
 *  1. Límites: cada unidad queda dentro de la región útil de la caja.
 *  2. Colisiones: ningún par de unidades se interseca.
 *  3. Peso: la suma no supera el peso útil (peso máximo − margen).
 *  4. Estabilidad: toda unidad que no está en el piso necesita al menos
 *     `minSupportRatio` de su base apoyada y su centro sobre la zona de apoyo.
 *  5. Fragilidad: nada se apoya sobre productos que no admiten peso; un producto
 *     pesado no se apoya sobre productos frágiles/blandos; y la carga acumulada
 *     (repartida por área de contacto y propagada hacia abajo) no supera la
 *     capacidad de cada unidad.
 *
 * Orden de colocación: primero lo rígido/resistente, luego lo semirresistente y al
 * final lo frágil o blando; dentro de cada grupo, de más pesado a más liviano y de
 * mayor a menor base. Cada unidad va al punto extremo más bajo, más al fondo y más
 * a la izquierda (z, y, x) y, a igualdad, en la orientación más baja (más estable).
 *
 * El resultado es determinista: el mismo carrito produce siempre el mismo acomodo.
 */
import { ORIENTATIONS, ORIENTATION_LABELS, type CartLine, type Orientation, type PackableBox, type PackableProduct } from '../domain';
import {
  distinctAllowedOrientations,
  fitsInRegion,
  footprintOverlapArea,
  orientedDims,
  overlaps,
  usableRegion,
  usableWeightG,
  type Aabb,
  type Dims,
} from './geometry';
import { failureMessage, tierReason } from './messages';
import {
  DEFAULT_PACKING_OPTIONS,
  type AdditionCheck,
  type FailureCode,
  type PackingEngine,
  type PackingInput,
  type PackingOptions,
  type PackingResult,
  type Placement,
  type PlacementTier,
  type UnplacedUnit,
  type UsableRegion,
  type Vec3,
} from './types';

export const EXTREME_POINTS_ALGORITHM_ID = 'extreme-points-v1';

interface Unit {
  unitId: string;
  /** Número de unidad dentro del producto (1..n). */
  n: number;
  product: PackableProduct;
  tier: PlacementTier;
  baseArea: number;
  volume: number;
  orientations: { orientation: Orientation; dims: Dims }[];
}

interface Supporter {
  idx: number;
  /** Fracción del peso de la unidad superior que recae sobre este soporte. */
  fraction: number;
}

interface PlacedItem extends Aabb {
  unit: Unit;
  orientation: Orientation;
  supporters: Supporter[];
  supportRatio: number;
  layer: number;
  capacity: number;
}

/** Estado mutable del empaquetado; se puede clonar para reanudar desde un prefijo. */
class PackState {
  placed: PlacedItem[] = [];
  loads: number[] = [];
  points: Vec3[] = [{ x: 0, y: 0, z: 0 }];
  weightG = 0;

  clone(): PackState {
    const s = new PackState();
    s.placed = this.placed.slice(); // los PlacedItem son inmutables
    s.loads = this.loads.slice();
    s.points = this.points.slice();
    s.weightG = this.weightG;
    return s;
  }
}

type PlaceOutcome = { ok: true } | { ok: false; code: FailureCode };

/**
 * Prioridad entre candidatos: el tope más bajo (z + alto) primero, para formar capas
 * planas y mantener bajo el centro de gravedad; luego lo más bajo, al fondo (y) y a
 * la izquierda (x). Se comparó contra "z más baja primero" y variantes por esquina:
 * el aprovechamiento es similar (~60% con mezclas aleatorias) pero este es más rápido
 * y produce acomodos más estables (acuesta lo que se puede acostar).
 */
function compareCandidates(a: Aabb, b: Aabb): number {
  return a.z + a.dz - (b.z + b.dz) || a.z - b.z || a.y - b.y || a.x - b.x;
}

/** Fallos que no dependen del orden de colocación: reordenar no los resuelve. */
const ORDER_INDEPENDENT: FailureCode[] = ['EXCEEDS_WEIGHT', 'TOO_LARGE', 'ORIENTATION_NOT_ALLOWED', 'INVALID_PRODUCT'];

// -----------------------------------------------------------------------------
// Clasificación y orden de unidades
// -----------------------------------------------------------------------------

export function tierOf(p: PackableProduct, options: PackingOptions = DEFAULT_PACKING_OPTIONS): PlacementTier {
  if (!p.canSupportWeight || p.fragility >= 3 || p.compressibility >= 3) return 2;
  if (p.fragility >= options.delicateLevel || p.compressibility >= options.delicateLevel) return 1;
  return 0;
}

function makeUnit(product: PackableProduct, n: number, options: PackingOptions): Unit {
  const orientations = distinctAllowedOrientations(product);
  const baseArea = orientations.reduce((m, o) => Math.max(m, o.dims.dx * o.dims.dy), 0);
  return {
    unitId: `${product.id}#${n}`,
    n,
    product,
    tier: tierOf(product, options),
    baseArea,
    volume: product.lengthMm * product.widthMm * product.heightMm,
    orientations,
  };
}

/** Orden total y determinista de colocación. */
export function compareUnits(a: Unit, b: Unit): number {
  return (
    a.tier - b.tier ||
    b.product.weightG - a.product.weightG ||
    b.baseArea - a.baseArea ||
    b.volume - a.volume ||
    (a.product.sku < b.product.sku ? -1 : a.product.sku > b.product.sku ? 1 : 0) ||
    (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0) ||
    a.n - b.n
  );
}

function expandUnits(lines: CartLine[], options: PackingOptions): Unit[] {
  const units: Unit[] = [];
  const merged = new Map<string, { product: PackableProduct; quantity: number }>();
  for (const line of lines) {
    const q = Math.max(0, Math.floor(line.quantity));
    if (q === 0) continue;
    const prev = merged.get(line.product.id);
    merged.set(line.product.id, { product: line.product, quantity: (prev?.quantity ?? 0) + q });
  }
  for (const { product, quantity } of merged.values()) {
    for (let n = 1; n <= quantity; n++) units.push(makeUnit(product, n, options));
  }
  return units.sort(compareUnits);
}

function isValidProduct(p: PackableProduct): boolean {
  return [p.lengthMm, p.widthMm, p.heightMm].every((v) => Number.isFinite(v) && v > 0) &&
    Number.isFinite(p.weightG) && p.weightG >= 0;
}

// -----------------------------------------------------------------------------
// Empaquetador
// -----------------------------------------------------------------------------

class ExtremePointsPacker {
  readonly region: UsableRegion;
  readonly usableWeight: number;

  constructor(
    readonly box: PackableBox,
    readonly options: PackingOptions,
  ) {
    this.region = usableRegion(box);
    this.usableWeight = usableWeightG(box);
  }

  /** Intenta colocar una unidad; si tiene éxito, muta el estado. */
  place(state: PackState, unit: Unit): PlaceOutcome {
    const p = unit.product;
    if (!isValidProduct(p)) return { ok: false, code: 'INVALID_PRODUCT' };
    if (state.weightG + p.weightG > this.usableWeight) return { ok: false, code: 'EXCEEDS_WEIGHT' };

    const orients = unit.orientations
      .filter((o) => fitsInRegion(o.dims, this.region))
      .sort((a, b) => a.dims.dz - b.dims.dz || ORIENTATIONS.indexOf(a.orientation) - ORIENTATIONS.indexOf(b.orientation));
    if (orients.length === 0) {
      const anyFits = ORIENTATIONS.some((o) => fitsInRegion(orientedDims(p, o), this.region));
      return { ok: false, code: anyFits ? 'ORIENTATION_NOT_ALLOWED' : 'TOO_LARGE' };
    }

    // Candidatos (punto extremo × orientación) dentro de la región, del mejor al peor.
    const candidates: { box: Aabb; orientation: Orientation; oi: number }[] = [];
    for (const pt of state.points) {
      for (let oi = 0; oi < orients.length; oi++) {
        const { orientation, dims } = orients[oi];
        const box: Aabb = { x: pt.x, y: pt.y, z: pt.z, ...dims };
        if (
          box.x + box.dx > this.region.lengthMm ||
          box.y + box.dy > this.region.widthMm ||
          box.z + box.dz > this.region.heightMm
        ) {
          continue;
        }
        candidates.push({ box, orientation, oi });
      }
    }
    candidates.sort((a, b) => compareCandidates(a.box, b.box) || a.oi - b.oi);

    // Etapa más avanzada alcanzada por algún candidato, para explicar el fallo.
    // 0 = sin hueco libre, 1 = hueco libre sin apoyo, 2 = apoyo ok pero regla de fragilidad.
    let bestStage = 0;

    {
      for (const { box, orientation } of candidates) {
        if (this.collides(state, box)) continue;

        const support = this.support(state, box);
        if (!support) {
          bestStage = Math.max(bestStage, 1);
          continue;
        }

        const delta = this.loadDelta(state, unit, support.supporters);
        if (!delta) {
          bestStage = 2;
          continue;
        }

        this.commit(state, unit, box, orientation, support, delta);
        return { ok: true };
      }
    }

    return { ok: false, code: bestStage === 2 ? 'FRAGILITY_RULE' : bestStage === 1 ? 'INSUFFICIENT_SUPPORT' : 'NO_SPACE' };
  }

  private collides(state: PackState, box: Aabb): boolean {
    for (const it of state.placed) if (overlaps(box, it)) return true;
    return false;
  }

  /** Calcula apoyo; devuelve null si la unidad quedaría flotando o inestable. */
  private support(state: PackState, box: Aabb): { supporters: Supporter[]; ratio: number; layer: number } | null {
    if (box.z === 0) return { supporters: [], ratio: 1, layer: 1 };

    const baseArea = box.dx * box.dy;
    const contacts: { idx: number; area: number; it: PlacedItem }[] = [];
    let total = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < state.placed.length; i++) {
      const it = state.placed[i];
      if (it.z + it.dz !== box.z) continue;
      const area = footprintOverlapArea(box, it);
      if (area <= 0) continue;
      contacts.push({ idx: i, area, it });
      total += area;
      minX = Math.min(minX, Math.max(box.x, it.x));
      minY = Math.min(minY, Math.max(box.y, it.y));
      maxX = Math.max(maxX, Math.min(box.x + box.dx, it.x + it.dx));
      maxY = Math.max(maxY, Math.min(box.y + box.dy, it.y + it.dy));
    }
    const ratio = total / baseArea;
    if (contacts.length === 0 || ratio + 1e-9 < this.options.minSupportRatio) return null;

    // El centro de la base debe caer dentro de la zona de apoyo.
    const cx = box.x + box.dx / 2;
    const cy = box.y + box.dy / 2;
    if (cx < minX || cx > maxX || cy < minY || cy > maxY) return null;

    return {
      supporters: contacts.map((c) => ({ idx: c.idx, fraction: c.area / total })),
      ratio: Math.min(1, ratio),
      layer: 1 + Math.max(...contacts.map((c) => c.it.layer)),
    };
  }

  /**
   * Reglas de fragilidad y carga acumulada. Devuelve el incremento de carga por
   * índice de unidad colocada, o null si alguna regla se viola.
   */
  private loadDelta(state: PackState, unit: Unit, supporters: Supporter[]): Map<number, number> | null {
    const w = unit.product.weightG;
    const heavy = w > this.options.heavyItemThresholdG;
    for (const s of supporters) {
      const sp = state.placed[s.idx].unit.product;
      if (!sp.canSupportWeight) return null;
      if (heavy && (sp.fragility >= this.options.delicateLevel || sp.compressibility >= this.options.delicateLevel)) {
        return null;
      }
    }
    if (supporters.length === 0) return new Map();

    // Un soporte siempre se coloca antes que lo que sostiene, así que propagar en
    // orden de índice descendente procesa cada unidad después de todas sus cargas.
    const delta = new Map<number, number>();
    for (const s of supporters) delta.set(s.idx, (delta.get(s.idx) ?? 0) + w * s.fraction);
    const pending = [...delta.keys()].sort((a, b) => b - a);
    const queued = new Set(pending);
    while (pending.length > 0) {
      const idx = pending.shift()!;
      const amount = delta.get(idx)!;
      const it = state.placed[idx];
      if (state.loads[idx] + amount > it.capacity + 1e-6) return null;
      for (const s of it.supporters) {
        delta.set(s.idx, (delta.get(s.idx) ?? 0) + amount * s.fraction);
        if (!queued.has(s.idx)) {
          queued.add(s.idx);
          // inserción ordenada (descendente)
          let k = 0;
          while (k < pending.length && pending[k] > s.idx) k++;
          pending.splice(k, 0, s.idx);
        }
      }
    }
    return delta;
  }

  private commit(
    state: PackState,
    unit: Unit,
    box: Aabb,
    orientation: Orientation,
    support: { supporters: Supporter[]; ratio: number; layer: number },
    delta: Map<number, number>,
  ): void {
    const p = unit.product;
    const item: PlacedItem = {
      ...box,
      unit,
      orientation,
      supporters: support.supporters,
      supportRatio: support.ratio,
      layer: support.layer,
      capacity: p.canSupportWeight ? Math.max(0, p.maxLoadOnTopG) : 0,
    };
    state.placed.push(item);
    state.loads.push(0);
    for (const [idx, amount] of delta) state.loads[idx] += amount;
    state.weightG += p.weightG;
    this.updatePoints(state, item);
  }

  private updatePoints(state: PackState, it: PlacedItem): void {
    const { x, y, z, dx, dy, dz } = it;
    const R = this.region;
    const placed = state.placed;

    // Proyecciones de un punto hacia el origen hasta la primera superficie.
    const projX = (p: Vec3) => {
      let best = 0;
      for (const o of placed) {
        const top = o.x + o.dx;
        if (top <= p.x && top > best && p.y >= o.y && p.y < o.y + o.dy && p.z >= o.z && p.z < o.z + o.dz) best = top;
      }
      return { ...p, x: best };
    };
    const projY = (p: Vec3) => {
      let best = 0;
      for (const o of placed) {
        const top = o.y + o.dy;
        if (top <= p.y && top > best && p.x >= o.x && p.x < o.x + o.dx && p.z >= o.z && p.z < o.z + o.dz) best = top;
      }
      return { ...p, y: best };
    };
    const projZ = (p: Vec3) => {
      let best = 0;
      for (const o of placed) {
        const top = o.z + o.dz;
        if (top <= p.z && top > best && p.x >= o.x && p.x < o.x + o.dx && p.y >= o.y && p.y < o.y + o.dy) best = top;
      }
      return { ...p, z: best };
    };

    const a = { x: x + dx, y, z };
    const b = { x, y: y + dy, z };
    const c = { x, y, z: z + dz };
    const candidates: Vec3[] = [a, b, c, projY(a), projZ(a), projX(b), projZ(b), projX(c), projY(c)];

    const inside = (p: Vec3, o: Aabb) =>
      p.x >= o.x && p.x < o.x + o.dx && p.y >= o.y && p.y < o.y + o.dy && p.z >= o.z && p.z < o.z + o.dz;

    const keys = new Set<string>();
    const next: Vec3[] = [];
    const push = (p: Vec3) => {
      if (p.x >= R.lengthMm || p.y >= R.widthMm || p.z >= R.heightMm) return;
      const key = `${p.x},${p.y},${p.z}`;
      if (keys.has(key)) return;
      keys.add(key);
      next.push(p);
    };
    for (const p of state.points) if (!inside(p, it)) push(p);
    for (const p of candidates) if (!placed.some((o) => inside(p, o))) push(p);
    state.points = next;
  }

  // ---------------------------------------------------------------------------

  run(units: Unit[], state = new PackState(), stopOnFailure = false): { state: PackState; failures: { unit: Unit; code: FailureCode }[] } {
    const failures: { unit: Unit; code: FailureCode }[] = [];
    for (const u of units) {
      const r = this.place(state, u);
      if (!r.ok) {
        failures.push({ unit: u, code: r.code });
        if (stopOnFailure) break;
      }
    }
    return { state, failures };
  }

  /**
   * Órdenes alternativos (deterministas) que se prueban cuando el orden principal
   * deja unidades fuera sin exceder el peso. Las reglas físicas se verifican igual
   * en cada pasada; solo cambia la prioridad de colocación.
   *  1. Base más grande primero (dentro de cada nivel): forma superficies amplias.
   *  2. Los productos que fallaron primero.
   */
  fallbackOrders(units: Unit[], failures: { unit: Unit }[]): Unit[][] {
    const byArea = units.slice().sort((a, b) => a.tier - b.tier || b.baseArea - a.baseArea || compareUnits(a, b));
    const failed = new Set(failures.map((f) => f.unit.product.id));
    const promoted = [...units.filter((u) => failed.has(u.product.id)), ...units.filter((u) => !failed.has(u.product.id))];
    return [byArea, promoted];
  }

  private reorderMayHelp(units: Unit[], failures: { code: FailureCode }[]): boolean {
    return totalWeight(units) <= this.usableWeight && !failures.some((f) => ORDER_INDEPENDENT.includes(f.code));
  }

  /** Ejecuta el orden principal y, si hace falta, los alternativos. Devuelve el mejor. */
  runBest(units: Unit[]): { state: PackState; failures: { unit: Unit; code: FailureCode }[] } {
    const first = this.run(units);
    if (first.failures.length === 0 || !this.reorderMayHelp(units, first.failures)) return first;
    let best = first;
    for (const order of this.fallbackOrders(units, first.failures)) {
      const r = this.run(order);
      if (r.failures.length === 0) return r;
      if (r.failures.length < best.failures.length) best = r;
    }
    return best;
  }

  /** Igual que `runBest` pero solo responde si todo cabe (más rápido). */
  fitsAll(units: Unit[], firstPassFailures: { unit: Unit; code: FailureCode }[]): boolean {
    if (firstPassFailures.length === 0) return true;
    if (!this.reorderMayHelp(units, firstPassFailures)) return false;
    return this.fallbackOrders(units, firstPassFailures).some((order) => this.run(order, new PackState(), true).failures.length === 0);
  }

  buildResult(units: Unit[], state: PackState, failures: { unit: Unit; code: FailureCode }[]): PackingResult {
    const R = this.region;
    const byIdx = state.placed;
    const placements: Placement[] = byIdx.map((it, i) => {
      const p = it.unit.product;
      const supportedBy = it.supporters.map((s) => byIdx[s.idx].unit.unitId);
      const where =
        it.z === 0
          ? 'En el piso de la caja'
          : `Sobre ${[...new Set(it.supporters.map((s) => byIdx[s.idx].unit.product.name))].join(', ')} (apoyo ${Math.round(
              it.supportRatio * 100,
            )}%)`;
      return {
        unitId: it.unit.unitId,
        productId: p.id,
        sku: p.sku,
        name: p.name,
        x: it.x + R.offset.x,
        y: it.y + R.offset.y,
        z: it.z + R.offset.z,
        lengthMm: it.dx,
        widthMm: it.dy,
        heightMm: it.dz,
        orientation: it.orientation,
        rotationLabel: ORIENTATION_LABELS[it.orientation],
        layer: it.layer,
        weightG: p.weightG,
        tier: it.unit.tier,
        supportedBy,
        supportRatio: it.supportRatio,
        loadOnTopG: Math.round(state.loads[i]),
        loadCapacityG: it.capacity,
        reason: `${tierReason(it.unit.tier)}. ${where}.`,
      };
    });

    let runningWeight = state.weightG;
    const unplaced: UnplacedUnit[] = failures.map(({ unit, code }) => ({
      unitId: unit.unitId,
      productId: unit.product.id,
      sku: unit.product.sku,
      name: unit.product.name,
      code,
      message: failureMessage(code, {
        name: unit.product.name,
        weightG: unit.product.weightG,
        remainingWeightG: this.usableWeight - runningWeight,
      }),
    }));

    const itemsVolumeMm3 = byIdx.reduce((s, it) => s + it.dx * it.dy * it.dz, 0);
    const usableVolumeMm3 = R.lengthMm * R.widthMm * R.heightMm;
    const b = this.box;

    const status =
      units.length === 0
        ? 'EMPTY'
        : failures.length === 0
          ? 'FITS'
          : failures.some((f) => f.code === 'EXCEEDS_WEIGHT')
            ? 'EXCEEDS_WEIGHT'
            : 'DOES_NOT_FIT';

    const reviewReasons: string[] = [];
    const products = byIdx.map((it) => it.unit.product);
    if (products.some((p) => p.fragility >= 3 || p.packagingType === 'JAR' || p.packagingType === 'FRAGILE')) {
      reviewReasons.push('Contiene productos frágiles (vidrio o similares): protegerlos con material de relleno.');
    }
    if (products.some((p) => p.packagingType === 'LIQUID' || p.packagingType === 'BOTTLE')) {
      reviewReasons.push('Contiene líquidos: verificar tapas selladas, bolsa protectora y posición vertical.');
    }
    if (byIdx.some((it) => it.supportRatio < 0.999)) {
      reviewReasons.push('Algunos productos tienen apoyo parcial: verificar la estabilidad antes de cerrar.');
    }
    if (usableVolumeMm3 > 0 && itemsVolumeMm3 / usableVolumeMm3 > 0.85) {
      reviewReasons.push('La caja está muy llena: el acomodo real puede requerir ajustes.');
    }
    if (failures.length > 0) reviewReasons.push('Hay productos que no caben: la orden no puede finalizarse así.');

    const shippingWarnings = [...new Map(products.filter((p) => p.shippingRestrictions?.trim()).map((p) => [p.id, p])).values()].map(
      (p) => ({ productId: p.id, name: p.name, message: p.shippingRestrictions!.trim() }),
    );

    return {
      algorithm: EXTREME_POINTS_ALGORITHM_ID,
      status,
      boxId: b.id,
      usableRegion: R,
      placements,
      unplaced,
      totals: {
        unitCount: units.length,
        placedCount: placements.length,
        weightG: state.weightG,
        usableWeightG: this.usableWeight,
        maxWeightG: b.maxWeightG,
        itemsVolumeMm3,
        usableVolumeMm3,
        boxVolumeMm3: b.innerLengthMm * b.innerWidthMm * b.innerHeightMm,
        volumeUtilization: usableVolumeMm3 > 0 ? itemsVolumeMm3 / usableVolumeMm3 : 0,
        weightUtilization: this.usableWeight > 0 ? state.weightG / this.usableWeight : 0,
        heightUsedMm: byIdx.reduce((m, it) => Math.max(m, it.z + it.dz), 0),
      },
      requiresReview: reviewReasons.length > 0,
      reviewReasons,
      shippingWarnings,
    };
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

function resolveOptions(o?: Partial<PackingOptions>): PackingOptions {
  return { ...DEFAULT_PACKING_OPTIONS, ...o };
}

export const extremePointsEngine: PackingEngine = {
  id: EXTREME_POINTS_ALGORITHM_ID,

  pack({ box, lines, options }: PackingInput): PackingResult {
    const opts = resolveOptions(options);
    const packer = new ExtremePointsPacker(box, opts);
    const units = expandUnits(lines, opts);
    const { state, failures } = packer.runBest(units);
    return packer.buildResult(units, state, failures);
  },

  checkAdditions({ box, lines, options }, candidates): Record<string, AdditionCheck> {
    const opts = resolveOptions(options);
    const packer = new ExtremePointsPacker(box, opts);
    const baseUnits = expandUnits(lines, opts);
    const qtyInCart = new Map<string, number>();
    for (const u of baseUnits) qtyInCart.set(u.product.id, Math.max(qtyInCart.get(u.product.id) ?? 0, u.n));

    // Primera pasada del carrito base guardando una instantánea antes de cada
    // unidad. La primera pasada del carrito extendido comparte ese prefijo, así que
    // se reanuda desde ahí: el resultado es idéntico a `pack` con el carrito
    // extendido, pero mucho más rápido para evaluar todo el catálogo.
    const snapshots: PackState[] = [];
    const baseFailures: { at: number; unit: Unit; code: FailureCode }[] = [];
    {
      const state = new PackState();
      baseUnits.forEach((u, at) => {
        snapshots.push(state.clone());
        const r = packer.place(state, u);
        if (!r.ok) baseFailures.push({ at, unit: u, code: r.code });
      });
      snapshots.push(state.clone());
    }
    const baseFits = packer.fitsAll(baseUnits, baseFailures);

    const baseWeight = totalWeight(baseUnits);
    const out: Record<string, AdditionCheck> = {};
    for (const { product, quantity = 1 } of candidates) {
      const q = Math.max(1, Math.floor(quantity));
      const fail = (code: FailureCode, failedProduct = product, remainingWeightG = packer.usableWeight - baseWeight): AdditionCheck => {
        const isSelf = failedProduct.id === product.id;
        const msg = failureMessage(code, {
          name: failedProduct.name,
          weightG: failedProduct.weightG * (isSelf ? q : 1),
          remainingWeightG,
        });
        return {
          productId: product.id,
          fits: false,
          code,
          message: isSelf ? msg : `Al agregar ${product.name}, ${failedProduct.name} dejaría de caber. ${msg}`,
        };
      };

      if (!baseFits) {
        const f = baseFailures[0];
        const msg = failureMessage(f.code, { name: f.unit.product.name, weightG: f.unit.product.weightG });
        out[product.id] = {
          productId: product.id,
          fits: false,
          code: f.code,
          message: `Primero ajusta la caja: el contenido actual no cabe. ${msg}`,
        };
        continue;
      }
      if (!isValidProduct(product)) {
        out[product.id] = fail('INVALID_PRODUCT');
        continue;
      }
      if (baseWeight + product.weightG * q > packer.usableWeight) {
        out[product.id] = fail('EXCEEDS_WEIGHT');
        continue;
      }

      const start = qtyInCart.get(product.id) ?? 0;
      const newUnits = Array.from({ length: q }, (_, i) => makeUnit(product, start + i + 1, opts));
      // Posición de inserción de las nuevas unidades en el orden global.
      let k = 0;
      while (k < baseUnits.length && compareUnits(baseUnits[k], newUnits[0]) < 0) k++;
      const extended = [...baseUnits.slice(0, k), ...newUnits, ...baseUnits.slice(k)];

      const resumed = packer.run([...newUnits, ...baseUnits.slice(k)], snapshots[k].clone());
      const failures = [...baseFailures.filter((f) => f.at < k), ...resumed.failures];
      if (packer.fitsAll(extended, failures)) {
        out[product.id] = { productId: product.id, fits: true };
        continue;
      }
      const f = failures.find((x) => x.unit.product.id === product.id) ?? failures[0];
      out[product.id] = fail(f.code, f.unit.product, packer.usableWeight - resumed.state.weightG);
    }
    return out;
  },
};

function totalWeight(units: Unit[]): number {
  return units.reduce((s, u) => s + u.product.weightG, 0);
}
