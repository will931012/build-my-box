/** Conversión de modelos Prisma a tipos de dominio compartidos. */
import type { Box as DbBox, Product as DbProduct } from '@prisma/client';
import { ORIENTATIONS, type Box, type Level, type Orientation, type Product } from '@bmb/shared';

const toLevel = (n: number): Level => Math.min(3, Math.max(0, Math.round(n))) as Level;

export function toProduct(p: DbProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    stock: p.stock,
    reserved: p.reserved,
    available: Math.max(0, p.stock - p.reserved),
    lengthMm: p.lengthMm,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    weightG: p.weightG,
    packagingType: p.packagingType,
    allowedOrientations: p.allowedOrientations.filter((o): o is Orientation => (ORIENTATIONS as readonly string[]).includes(o)),
    canSupportWeight: p.canSupportWeight,
    maxLoadOnTopG: p.maxLoadOnTopG,
    fragility: toLevel(p.fragility),
    compressibility: toLevel(p.compressibility),
    shippingRestrictions: p.shippingRestrictions,
    active: p.active,
  };
}

export function toBox(b: DbBox): Box {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    innerLengthMm: b.innerLengthMm,
    innerWidthMm: b.innerWidthMm,
    innerHeightMm: b.innerHeightMm,
    maxWeightG: b.maxWeightG,
    priceCents: b.priceCents,
    safetyMarginPct: b.safetyMarginPct,
    active: b.active,
  };
}
