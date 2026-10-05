import type { Prisma } from '@prisma/client';
import type { Box, CartInput, CartLine, Product } from '@bmb/shared';
import { prisma } from '../db';
import { HttpError, notFound } from '../http';
import { toBox, toProduct } from '../mappers';

export async function listProducts(filter: { search?: string; category?: string; includeInactive?: boolean } = {}): Promise<Product[]> {
  const where: Prisma.ProductWhereInput = {};
  if (!filter.includeInactive) where.active = true;
  if (filter.category) where.category = filter.category;
  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { sku: { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.product.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  return rows.map(toProduct);
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({ where: { active: true }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
  return rows.map((r) => r.category);
}

export async function listBoxes(includeInactive = false): Promise<Box[]> {
  const rows = await prisma.box.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ priceCents: 'asc' }],
  });
  return rows.map(toBox);
}

export async function getActiveBox(id: string): Promise<Box> {
  const b = await prisma.box.findFirst({ where: { id, active: true } });
  if (!b) throw notFound('Caja');
  return toBox(b);
}

/**
 * Convierte el carrito recibido en líneas con productos reales de la base de datos.
 * Rechaza productos inexistentes o inactivos.
 */
export async function loadCart(input: CartInput): Promise<{ box: Box; lines: CartLine<Product>[] }> {
  const box = await getActiveBox(input.boxId);
  const qty = new Map<string, number>();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
  const rows = await prisma.product.findMany({ where: { id: { in: [...qty.keys()] }, active: true } });
  const missing = [...qty.keys()].filter((id) => !rows.some((r) => r.id === id));
  if (missing.length > 0) {
    throw new HttpError(422, 'Algunos productos no existen o ya no están disponibles', { productIds: missing });
  }
  const lines = rows.map((r) => ({ product: toProduct(r), quantity: qty.get(r.id)! }));
  return { box, lines };
}

/** Verifica que haya stock disponible para cada línea. */
export function assertStock(lines: CartLine<Product>[]): void {
  const short = lines.filter((l) => l.quantity > l.product.available);
  if (short.length > 0) {
    throw new HttpError(
      409,
      `Stock insuficiente: ${short.map((l) => `${l.product.name} (disponible ${l.product.available})`).join(', ')}`,
      short.map((l) => ({ productId: l.product.id, requested: l.quantity, available: l.product.available })),
    );
  }
}
