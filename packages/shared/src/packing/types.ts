import type { CartLine, Orientation, PackableBox, PackableProduct } from '../domain';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Región útil de la caja (dimensiones internas menos el margen de seguridad), centrada en la caja. */
export interface UsableRegion {
  /** Desplazamiento desde la esquina interna de la caja (mm). */
  offset: Vec3;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export type PlacementTier = 0 | 1 | 2;

export interface Placement {
  /** Identificador estable de la unidad: `${productId}#${n}` (n empieza en 1). */
  unitId: string;
  productId: string;
  sku: string;
  name: string;
  /** Posición de la esquina mínima, en mm, relativa a la esquina interna de la caja. */
  x: number;
  y: number;
  z: number;
  /** Dimensiones usadas tras rotar: extensión en x (largo), y (ancho), z (alto). */
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  orientation: Orientation;
  rotationLabel: string;
  /** Nivel de apilamiento: 1 = sobre el piso de la caja. */
  layer: number;
  weightG: number;
  tier: PlacementTier;
  supportedBy: string[];
  /** Fracción de la base apoyada (1 = completamente apoyado). */
  supportRatio: number;
  /** Carga acumulada final que soporta encima (g). */
  loadOnTopG: number;
  /** Capacidad de carga encima (g); 0 si no admite peso. */
  loadCapacityG: number;
  /** Explicación legible de por qué quedó en esa posición. */
  reason: string;
}

export type FailureCode =
  | 'EXCEEDS_WEIGHT'
  | 'TOO_LARGE'
  | 'ORIENTATION_NOT_ALLOWED'
  | 'NO_SPACE'
  | 'INSUFFICIENT_SUPPORT'
  | 'FRAGILITY_RULE'
  | 'INVALID_PRODUCT';

export interface UnplacedUnit {
  unitId: string;
  productId: string;
  sku: string;
  name: string;
  code: FailureCode;
  message: string;
}

export type PackingStatus = 'EMPTY' | 'FITS' | 'DOES_NOT_FIT' | 'EXCEEDS_WEIGHT';

export interface PackingTotals {
  unitCount: number;
  placedCount: number;
  weightG: number;
  usableWeightG: number;
  maxWeightG: number;
  itemsVolumeMm3: number;
  usableVolumeMm3: number;
  boxVolumeMm3: number;
  /** Volumen de productos / volumen útil (0–1). Es solo informativo: la capacidad real la decide el packing. */
  volumeUtilization: number;
  weightUtilization: number;
  /** Altura máxima ocupada (mm) dentro de la región útil. */
  heightUsedMm: number;
}

export interface PackingResult {
  algorithm: string;
  status: PackingStatus;
  boxId: string;
  usableRegion: UsableRegion;
  placements: Placement[];
  unplaced: UnplacedUnit[];
  totals: PackingTotals;
  /** true si el acomodo requiere revisión del personal de empaque. */
  requiresReview: boolean;
  reviewReasons: string[];
  /** Advertencias de envío por producto (restricciones configuradas). */
  shippingWarnings: { productId: string; name: string; message: string }[];
}

export interface PackingOptions {
  /** Fracción mínima de la base que debe estar apoyada (por defecto 0.75). */
  minSupportRatio: number;
  /** Peso a partir del cual un producto se considera "pesado" (g, por defecto 500). */
  heavyItemThresholdG: number;
  /** Nivel de fragilidad/compresibilidad a partir del cual no se acepta un producto pesado encima. */
  delicateLevel: number;
}

export const DEFAULT_PACKING_OPTIONS: PackingOptions = {
  minSupportRatio: 0.75,
  heavyItemThresholdG: 500,
  delicateLevel: 2,
};

export interface PackingInput {
  box: PackableBox;
  lines: CartLine[];
  options?: Partial<PackingOptions>;
}

export interface AdditionCheck {
  productId: string;
  fits: boolean;
  code?: FailureCode;
  message?: string;
}

/**
 * Contrato del motor de packing. Permite sustituir el algoritmo en el futuro
 * (p. ej. un solver exacto o uno basado en capas) sin cambiar la app.
 */
export interface PackingEngine {
  readonly id: string;
  pack(input: PackingInput): PackingResult;
  /**
   * Evalúa si agregar `quantity` unidades de cada candidato (por separado) mantiene
   * la caja válida. Debe ser equivalente a `pack` con el carrito extendido.
   */
  checkAdditions(
    input: PackingInput,
    candidates: { product: PackableProduct; quantity?: number }[],
  ): Record<string, AdditionCheck>;
}
