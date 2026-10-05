/**
 * Tipos de dominio compartidos entre frontend, backend y motor de packing.
 *
 * Unidades canónicas (enteros siempre que sea posible):
 *  - longitudes en milímetros (mm)
 *  - pesos en gramos (g)
 *  - precios en centavos de USD
 */

export const PACKAGING_TYPES = [
  'RIGID',
  'BOX',
  'CAN',
  'BAG',
  'BOTTLE',
  'LIQUID',
  'JAR',
  'FRAGILE',
  'SOFT',
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const PACKAGING_LABELS: Record<PackagingType, string> = {
  RIGID: 'Rígido',
  BOX: 'Caja / cartón',
  CAN: 'Lata',
  BAG: 'Bolsa',
  BOTTLE: 'Botella',
  LIQUID: 'Líquido',
  JAR: 'Frasco de vidrio',
  FRAGILE: 'Frágil',
  SOFT: 'Blando',
};

/**
 * Orientación: qué dimensión del producto (L = largo, W = ancho, H = alto)
 * queda alineada con cada eje de la caja (x = largo, y = ancho, z = alto/vertical).
 * Ej.: 'LWH' = posición natural (de pie); 'WLH' = de pie girado 90°;
 * 'LHW' = acostado sobre un costado, etc.
 */
export const ORIENTATIONS = ['LWH', 'WLH', 'LHW', 'HLW', 'WHL', 'HWL'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  LWH: 'Posición natural',
  WLH: 'Posición natural, girado 90°',
  LHW: 'De costado',
  HLW: 'De costado, girado 90°',
  WHL: 'De canto (sobre un extremo)',
  HWL: 'De canto, girado 90°',
};

/** Orientaciones que mantienen el alto (H) del producto en vertical: "este lado arriba". */
export const UPRIGHT_ORIENTATIONS: Orientation[] = ['LWH', 'WLH'];

/** 0 = ninguna, 1 = baja, 2 = media, 3 = alta */
export type Level = 0 | 1 | 2 | 3;
export const LEVEL_LABELS: Record<Level, string> = { 0: 'Ninguna', 1: 'Baja', 2: 'Media', 3: 'Alta' };

/** Datos físicos de un producto que necesita el motor de packing. */
export interface PackableProduct {
  id: string;
  sku: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightG: number;
  packagingType: PackagingType;
  allowedOrientations: Orientation[];
  canSupportWeight: boolean;
  /** Carga máxima acumulada que puede soportar encima (g). Se ignora si canSupportWeight = false. */
  maxLoadOnTopG: number;
  fragility: Level;
  compressibility: Level;
  /** Restricciones/advertencias de envío en texto libre (se muestran al empacador). */
  shippingRestrictions?: string;
}

/** Producto completo del catálogo (lo que devuelve la API). */
export interface Product extends PackableProduct {
  description: string;
  category: string;
  imageUrl: string | null;
  priceCents: number;
  stock: number;
  reserved: number;
  /** stock - reserved */
  available: number;
  active: boolean;
}

export interface PackableBox {
  id: string;
  name: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  maxWeightG: number;
  /** Porcentaje (0–50) de holgura reservada en peso y volumen. */
  safetyMarginPct: number;
}

export interface Box extends PackableBox {
  description: string;
  priceCents: number;
  active: boolean;
}

export interface CartLine<P extends PackableProduct = PackableProduct> {
  product: P;
  quantity: number;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'FULFILLED' | 'CANCELLED';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagada',
  FULFILLED: 'Empacada / enviada',
  CANCELLED: 'Cancelada',
};
