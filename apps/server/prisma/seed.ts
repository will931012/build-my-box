/**
 * Carga datos de prueba: cajas y productos de mercado realistas.
 * Es idempotente: actualiza por SKU / nombre si ya existen (no toca órdenes).
 */
import { PrismaClient } from '@prisma/client';
import { SEED_BOXES, SEED_PRODUCTS } from '@bmb/shared/seed';

const prisma = new PrismaClient();

async function main() {
  for (const b of SEED_BOXES) {
    const existing = await prisma.box.findFirst({ where: { name: b.name } });
    if (existing) await prisma.box.update({ where: { id: existing.id }, data: b });
    else await prisma.box.create({ data: b });
  }
  for (const p of SEED_PRODUCTS) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: p, create: p });
  }
  console.log(`Seed listo: ${SEED_BOXES.length} cajas, ${SEED_PRODUCTS.length} productos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
