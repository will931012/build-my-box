/** Esquemas Zod compartidos para validar entradas de la API y formularios. */
import { z } from 'zod';
import { ORIENTATIONS, PACKAGING_TYPES } from './domain';

const level = z.number().int().min(0).max(3);
const mm = z.number().int('Usa milímetros enteros').positive('Debe ser mayor que 0').max(3000, 'Máximo 3 m');
const grams = z.number().int('Usa gramos enteros').min(0).max(100_000);

export const productInputSchema = z
  .object({
    sku: z.string().trim().min(2, 'SKU requerido').max(40),
    name: z.string().trim().min(2, 'Nombre requerido').max(120),
    description: z.string().trim().max(2000).default(''),
    category: z.string().trim().min(2, 'Categoría requerida').max(60),
    imageUrl: z.string().trim().url('URL inválida').max(500).nullable().or(z.literal('').transform(() => null)).default(null),
    priceCents: z.number().int().min(0).max(1_000_000),
    stock: z.number().int().min(0).max(1_000_000),
    lengthMm: mm,
    widthMm: mm,
    heightMm: mm,
    weightG: grams.refine((g) => g > 0, 'Debe ser mayor que 0'),
    packagingType: z.enum(PACKAGING_TYPES),
    allowedOrientations: z.array(z.enum(ORIENTATIONS)).min(1, 'Selecciona al menos una orientación'),
    canSupportWeight: z.boolean(),
    maxLoadOnTopG: grams,
    fragility: level,
    compressibility: level,
    shippingRestrictions: z.string().trim().max(1000).default(''),
    active: z.boolean().default(true),
  })
  .refine((p) => !p.canSupportWeight || p.maxLoadOnTopG > 0, {
    message: 'Si soporta peso encima, indica cuánto (g)',
    path: ['maxLoadOnTopG'],
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const boxInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  innerLengthMm: mm,
  innerWidthMm: mm,
  innerHeightMm: mm,
  maxWeightG: grams.refine((g) => g > 0, 'Debe ser mayor que 0'),
  priceCents: z.number().int().min(0).max(1_000_000),
  safetyMarginPct: z.number().min(0).max(50),
  active: z.boolean().default(true),
});
export type BoxInput = z.infer<typeof boxInputSchema>;

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
});

export const cartSchema = z.object({
  boxId: z.string().min(1),
  items: z.array(cartItemSchema).max(200),
});
export type CartInput = z.infer<typeof cartSchema>;

export const checkAdditionsSchema = cartSchema.extend({
  candidateProductIds: z.array(z.string().min(1)).max(500).optional(),
});

export const recipientSchema = z.object({
  name: z.string().trim().min(3, 'Nombre del destinatario requerido').max(120),
  phone: z.string().trim().min(6, 'Teléfono requerido').max(40),
  address: z.string().trim().min(5, 'Dirección requerida').max(300),
  city: z.string().trim().min(2, 'Ciudad / municipio requerido').max(80),
  province: z.string().trim().max(80).default(''),
  country: z.string().trim().min(2).max(60).default('Cuba'),
  notes: z.string().trim().max(500).default(''),
});
export type RecipientInput = z.infer<typeof recipientSchema>;

export const createOrderSchema = cartSchema.extend({
  recipient: recipientSchema,
  /** 'pay' = checkout simulado inmediato; 'save' = guardar la orden pendiente de pago. */
  action: z.enum(['pay', 'save']),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const customsSchema = z.object({
  customsDeclaration: z.string().max(4000),
});

export const stockAdjustSchema = z.object({
  stock: z.number().int().min(0).max(1_000_000),
});
