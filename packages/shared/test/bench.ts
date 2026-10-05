/** Benchmark rápido del motor: `npm run bench`. */
import { checkAdditions, packCart } from '../src/packing';
import { SEED_BOXES, SEED_PRODUCTS } from '../src/seedData';

const products = SEED_PRODUCTS.map((p) => ({ ...p, id: p.sku }));
const box = { ...SEED_BOXES[2], id: 'grande' };

for (const units of [10, 25, 50, 80]) {
  // Carrito mezclado de `units` unidades livianas para no topar el peso.
  const lines = products.slice(0, units).map((p) => ({ product: p, quantity: 1 }));
  while (lines.reduce((s, l) => s + l.quantity, 0) < units) lines[lines.length % products.length].quantity++;
  const light = { ...box, maxWeightG: 1_000_000 };

  let t = performance.now();
  const r = packCart(light, lines);
  const packMs = performance.now() - t;

  t = performance.now();
  checkAdditions(light, lines, products.map((p) => ({ product: p })));
  const checkMs = performance.now() - t;

  console.log(
    `${String(units).padStart(3)} unidades → pack ${packMs.toFixed(1)} ms (${r.placements.length} colocadas, ${r.status}), ` +
      `checkAdditions(${products.length} productos) ${checkMs.toFixed(1)} ms`,
  );
}
