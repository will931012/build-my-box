/**
 * Datos de prueba realistas (dimensiones y pesos de envío aproximados de
 * productos de mercado comunes). Los usan el seed de la base de datos, las
 * pruebas y el benchmark del motor.
 */
import type { Orientation, PackagingType } from './domain';

export interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightG: number;
  packagingType: PackagingType;
  allowedOrientations: Orientation[];
  canSupportWeight: boolean;
  maxLoadOnTopG: number;
  fragility: 0 | 1 | 2 | 3;
  compressibility: 0 | 1 | 2 | 3;
  shippingRestrictions: string;
}

export interface SeedBox {
  name: string;
  description: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  maxWeightG: number;
  priceCents: number;
  safetyMarginPct: number;
}

const ALL: Orientation[] = ['LWH', 'WLH', 'LHW', 'HLW', 'WHL', 'HWL'];
const UPRIGHT: Orientation[] = ['LWH', 'WLH'];
/** Bolsas y paquetes planos: solo acostados (la cara grande hacia abajo). */
const FLAT: Orientation[] = ['LWH', 'WLH'];

export const SEED_BOXES: SeedBox[] = [
  {
    name: 'Caja Estándar',
    description: 'Caja de cartón corrugado doble pared. La más usada para envíos familiares.',
    innerLengthMm: 500,
    innerWidthMm: 400,
    innerHeightMm: 400,
    maxWeightG: 25_000,
    priceCents: 3500,
    safetyMarginPct: 10,
  },
  {
    name: 'Caja Pequeña',
    description: 'Ideal para encargos ligeros o de aseo personal.',
    innerLengthMm: 400,
    innerWidthMm: 300,
    innerHeightMm: 300,
    maxWeightG: 15_000,
    priceCents: 2500,
    safetyMarginPct: 10,
  },
  {
    name: 'Caja Grande',
    description: 'Máxima capacidad permitida por la agencia de envío.',
    innerLengthMm: 600,
    innerWidthMm: 500,
    innerHeightMm: 450,
    maxWeightG: 32_000,
    priceCents: 4900,
    safetyMarginPct: 10,
  },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  // --- Granos y básicos -----------------------------------------------------
  {
    sku: 'ARR-1KG', name: 'Arroz blanco 1 kg', category: 'Granos',
    description: 'Arroz de grano largo, bolsa plástica sellada.',
    priceCents: 250, stock: 200, lengthMm: 220, widthMm: 130, heightMm: 60, weightG: 1020,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'ARR-5KG', name: 'Arroz blanco 5 kg', category: 'Granos',
    description: 'Saco de arroz de grano largo.',
    priceCents: 1050, stock: 60, lengthMm: 400, widthMm: 270, heightMm: 90, weightG: 5050,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 25_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'FRJ-1KG', name: 'Frijoles negros 1 kg', category: 'Granos',
    description: 'Frijol negro seleccionado, bolsa sellada.',
    priceCents: 320, stock: 150, lengthMm: 200, widthMm: 130, heightMm: 60, weightG: 1020,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'AZU-1KG', name: 'Azúcar refino 1 kg', category: 'Granos',
    description: 'Azúcar blanca refinada.',
    priceCents: 210, stock: 120, lengthMm: 180, widthMm: 110, heightMm: 70, weightG: 1010,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'HAR-1KG', name: 'Harina de trigo 1 kg', category: 'Granos',
    description: 'Harina de trigo todo uso, paquete de papel.',
    priceCents: 230, stock: 80, lengthMm: 190, widthMm: 120, heightMm: 75, weightG: 1015,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 10_000,
    fragility: 1, compressibility: 1, shippingRestrictions: 'Empacar dentro de bolsa plástica para evitar derrames.',
  },
  // --- Aceites y líquidos ----------------------------------------------------
  {
    sku: 'ACE-1L', name: 'Aceite vegetal 1 L', category: 'Aceites y salsas',
    description: 'Aceite de soya en botella plástica.',
    priceCents: 420, stock: 100, lengthMm: 90, widthMm: 70, heightMm: 285, weightG: 950,
    packagingType: 'LIQUID', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 2_000,
    fragility: 1, compressibility: 0, shippingRestrictions: 'Líquido: sellar la tapa con cinta y colocar en bolsa. Siempre vertical.',
  },
  {
    sku: 'ACE-5L', name: 'Aceite vegetal 5 L', category: 'Aceites y salsas',
    description: 'Garrafa de aceite de soya.',
    priceCents: 1690, stock: 30, lengthMm: 190, widthMm: 130, heightMm: 320, weightG: 4700,
    packagingType: 'LIQUID', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 4_000,
    fragility: 1, compressibility: 0, shippingRestrictions: 'Líquido: sellar la tapa con cinta y colocar en bolsa. Siempre vertical.',
  },
  {
    sku: 'SAL-TOM', name: 'Salsa de tomate en frasco 500 g', category: 'Aceites y salsas',
    description: 'Salsa de tomate natural en frasco de vidrio.',
    priceCents: 290, stock: 50, lengthMm: 75, widthMm: 75, heightMm: 150, weightG: 750,
    packagingType: 'JAR', allowedOrientations: UPRIGHT, canSupportWeight: false, maxLoadOnTopG: 0,
    fragility: 3, compressibility: 0, shippingRestrictions: 'Vidrio: envolver en plástico de burbujas.',
  },
  {
    sku: 'MER-GUA', name: 'Mermelada de guayaba 450 g', category: 'Aceites y salsas',
    description: 'Mermelada de guayaba en frasco de vidrio.',
    priceCents: 380, stock: 40, lengthMm: 80, widthMm: 80, heightMm: 110, weightG: 700,
    packagingType: 'JAR', allowedOrientations: UPRIGHT, canSupportWeight: false, maxLoadOnTopG: 0,
    fragility: 3, compressibility: 0, shippingRestrictions: 'Vidrio: envolver en plástico de burbujas.',
  },
  // --- Lácteos y café ---------------------------------------------------------
  {
    sku: 'LEC-POL-1KG', name: 'Leche en polvo entera 1 kg (lata)', category: 'Lácteos y café',
    description: 'Leche entera en polvo, lata metálica con tapa.',
    priceCents: 1290, stock: 70, lengthMm: 130, widthMm: 130, heightMm: 180, weightG: 1150,
    packagingType: 'CAN', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 20_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'LEC-POL-400', name: 'Leche en polvo 400 g (bolsa)', category: 'Lácteos y café',
    description: 'Leche en polvo instantánea, bolsa metalizada.',
    priceCents: 560, stock: 90, lengthMm: 180, widthMm: 120, heightMm: 50, weightG: 420,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 6_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'LEC-UHT', name: 'Leche UHT 1 L (tetra pak)', category: 'Lácteos y café',
    description: 'Leche entera de larga duración.',
    priceCents: 230, stock: 80, lengthMm: 95, widthMm: 65, heightMm: 200, weightG: 1050,
    packagingType: 'LIQUID', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 8_000,
    fragility: 0, compressibility: 0, shippingRestrictions: 'Líquido en envase de cartón: mantener vertical.',
  },
  {
    sku: 'CAF-250', name: 'Café molido 250 g', category: 'Lácteos y café',
    description: 'Café tostado y molido, paquete al vacío (ladrillo).',
    priceCents: 450, stock: 120, lengthMm: 130, widthMm: 80, heightMm: 50, weightG: 260,
    packagingType: 'RIGID', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 8_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'CAF-1KG', name: 'Café en grano 1 kg', category: 'Lácteos y café',
    description: 'Café en grano tostado, bolsa con válvula.',
    priceCents: 1490, stock: 0, lengthMm: 250, widthMm: 150, heightMm: 90, weightG: 1030,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 4_000,
    fragility: 0, compressibility: 2, shippingRestrictions: '',
  },
  {
    sku: 'CHO-400', name: 'Chocolate en polvo 400 g', category: 'Lácteos y café',
    description: 'Cocoa instantánea, bote plástico.',
    priceCents: 520, stock: 60, lengthMm: 110, widthMm: 110, heightMm: 140, weightG: 450,
    packagingType: 'RIGID', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 6_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  // --- Conservas (latas) -------------------------------------------------------
  {
    sku: 'ATU-160', name: 'Atún en lata 160 g', category: 'Conservas',
    description: 'Atún en aceite, lata con abre fácil.',
    priceCents: 180, stock: 300, lengthMm: 85, widthMm: 85, heightMm: 40, weightG: 185,
    packagingType: 'CAN', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'SAR-125', name: 'Sardinas en lata 125 g', category: 'Conservas',
    description: 'Sardinas en salsa de tomate, lata rectangular.',
    priceCents: 150, stock: 250, lengthMm: 105, widthMm: 75, heightMm: 25, weightG: 140,
    packagingType: 'CAN', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'FRJ-LAT', name: 'Frijoles negros en lata 400 g', category: 'Conservas',
    description: 'Frijoles negros cocidos listos para servir.',
    priceCents: 190, stock: 160, lengthMm: 75, widthMm: 75, heightMm: 110, weightG: 450,
    packagingType: 'CAN', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'LEC-CON', name: 'Leche condensada 397 g', category: 'Conservas',
    description: 'Leche condensada azucarada en lata.',
    priceCents: 240, stock: 140, lengthMm: 75, widthMm: 75, heightMm: 80, weightG: 420,
    packagingType: 'CAN', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'SPAM-340', name: 'Carne de cerdo en lata 340 g', category: 'Conservas',
    description: 'Carne de almuerzo en lata rectangular.',
    priceCents: 450, stock: 100, lengthMm: 100, widthMm: 60, heightMm: 85, weightG: 380,
    packagingType: 'CAN', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 15_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  // --- Pastas y galletas --------------------------------------------------------
  {
    sku: 'PAS-SPA', name: 'Espaguetis 500 g', category: 'Pastas y galletas',
    description: 'Pasta larga de sémola de trigo.',
    priceCents: 160, stock: 200, lengthMm: 260, widthMm: 75, heightMm: 35, weightG: 520,
    packagingType: 'BOX', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 5_000,
    fragility: 1, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'PAS-COD', name: 'Coditos 500 g', category: 'Pastas y galletas',
    description: 'Pasta corta en bolsa.',
    priceCents: 150, stock: 180, lengthMm: 200, widthMm: 140, heightMm: 60, weightG: 520,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 4_000,
    fragility: 1, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'GAL-SOD', name: 'Galletas de soda 300 g', category: 'Pastas y galletas',
    description: 'Galletas saladas en paquetes individuales.',
    priceCents: 210, stock: 150, lengthMm: 220, widthMm: 80, heightMm: 60, weightG: 320,
    packagingType: 'BOX', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 1_000,
    fragility: 2, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'GAL-DUL', name: 'Galletas dulces surtidas 400 g', category: 'Pastas y galletas',
    description: 'Surtido de galletas de mantequilla en caja.',
    priceCents: 390, stock: 90, lengthMm: 250, widthMm: 180, heightMm: 70, weightG: 430,
    packagingType: 'BOX', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 1_500,
    fragility: 2, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'PAN-TOS', name: 'Pan tostado 240 g', category: 'Pastas y galletas',
    description: 'Tostadas crujientes en caja. Muy frágil.',
    priceCents: 280, stock: 60, lengthMm: 180, widthMm: 110, heightMm: 90, weightG: 260,
    packagingType: 'FRAGILE', allowedOrientations: UPRIGHT, canSupportWeight: false, maxLoadOnTopG: 0,
    fragility: 3, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'PAP-FRI', name: 'Papas fritas 150 g', category: 'Pastas y galletas',
    description: 'Bolsa inflada de papas fritas. Blanda y frágil.',
    priceCents: 250, stock: 80, lengthMm: 300, widthMm: 200, heightMm: 90, weightG: 170,
    packagingType: 'SOFT', allowedOrientations: FLAT, canSupportWeight: false, maxLoadOnTopG: 0,
    fragility: 3, compressibility: 3, shippingRestrictions: '',
  },
  {
    sku: 'CAR-500', name: 'Caramelos surtidos 500 g', category: 'Pastas y galletas',
    description: 'Bolsa de caramelos duros.',
    priceCents: 330, stock: 70, lengthMm: 250, widthMm: 180, heightMm: 60, weightG: 510,
    packagingType: 'BAG', allowedOrientations: FLAT, canSupportWeight: true, maxLoadOnTopG: 3_000,
    fragility: 0, compressibility: 2, shippingRestrictions: '',
  },
  // --- Aseo y limpieza --------------------------------------------------------
  {
    sku: 'DET-POL', name: 'Detergente en polvo 1 kg', category: 'Aseo y limpieza',
    description: 'Detergente para ropa en caja de cartón.',
    priceCents: 390, stock: 90, lengthMm: 190, widthMm: 65, heightMm: 250, weightG: 1050,
    packagingType: 'BOX', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 10_000,
    fragility: 0, compressibility: 0, shippingRestrictions: 'Producto químico: separar de los alimentos con bolsa sellada.',
  },
  {
    sku: 'DET-LIQ', name: 'Detergente líquido 1 L', category: 'Aseo y limpieza',
    description: 'Detergente líquido concentrado.',
    priceCents: 480, stock: 50, lengthMm: 110, widthMm: 70, heightMm: 260, weightG: 1100,
    packagingType: 'LIQUID', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 2_000,
    fragility: 1, compressibility: 0, shippingRestrictions: 'Químico líquido: sellar tapa, doble bolsa y separar de alimentos.',
  },
  {
    sku: 'SHA-400', name: 'Shampoo 400 ml', category: 'Aseo y limpieza',
    description: 'Shampoo para todo tipo de cabello.',
    priceCents: 450, stock: 80, lengthMm: 70, widthMm: 45, heightMm: 200, weightG: 450,
    packagingType: 'BOTTLE', allowedOrientations: UPRIGHT, canSupportWeight: true, maxLoadOnTopG: 1_500,
    fragility: 1, compressibility: 0, shippingRestrictions: 'Líquido: sellar la tapa con cinta.',
  },
  {
    sku: 'JAB-3', name: 'Jabón de baño (pack 3)', category: 'Aseo y limpieza',
    description: 'Tres pastillas de jabón de tocador.',
    priceCents: 320, stock: 150, lengthMm: 200, widthMm: 65, heightMm: 35, weightG: 400,
    packagingType: 'RIGID', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 8_000,
    fragility: 0, compressibility: 0, shippingRestrictions: '',
  },
  {
    sku: 'PAS-DEN', name: 'Pasta dental 100 ml', category: 'Aseo y limpieza',
    description: 'Crema dental con flúor.',
    priceCents: 210, stock: 200, lengthMm: 190, widthMm: 45, heightMm: 40, weightG: 150,
    packagingType: 'BOX', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 3_000,
    fragility: 0, compressibility: 1, shippingRestrictions: '',
  },
  {
    sku: 'PAP-HIG', name: 'Papel higiénico (4 rollos)', category: 'Aseo y limpieza',
    description: 'Papel higiénico doble hoja. Blando y compresible.',
    priceCents: 350, stock: 100, lengthMm: 220, widthMm: 110, heightMm: 110, weightG: 400,
    packagingType: 'SOFT', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 1_000,
    fragility: 0, compressibility: 3, shippingRestrictions: '',
  },
  {
    sku: 'TOA-SAN', name: 'Toallas sanitarias (paquete)', category: 'Aseo y limpieza',
    description: 'Paquete de 10 toallas sanitarias.',
    priceCents: 290, stock: 120, lengthMm: 200, widthMm: 120, heightMm: 80, weightG: 250,
    packagingType: 'SOFT', allowedOrientations: ALL, canSupportWeight: true, maxLoadOnTopG: 1_500,
    fragility: 0, compressibility: 2, shippingRestrictions: '',
  },
];
