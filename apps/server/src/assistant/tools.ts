/**
 * Capa de herramientas para un futuro asistente inteligente.
 *
 * Principios de seguridad:
 *  - Todas las herramientas registradas son de SOLO LECTURA: consultan y proponen,
 *    nunca modifican inventario, órdenes ni cobran.
 *  - Toda respuesta sobre "si cabe" sale del motor de packing determinista; el
 *    asistente no puede saltarse sus restricciones físicas.
 *  - Una herramienta que mutara datos tendría que declarar `mutates: true` y el
 *    registro exige una aprobación humana explícita (`humanApproval`) para ejecutarla.
 *
 * Las definiciones (nombre, descripción, esquema JSON de entrada) se pueden pasar
 * tal cual a un LLM con "tool use"; el handler se ejecuta en el servidor.
 */
import { z } from 'zod';
import {
  cartSchema,
  checkAdditions,
  findSubstitutes,
  packCart,
  packingInstructions,
  placementsByLayer,
  smallFittingProducts,
  suggestFill,
  formatWeight,
  formatPercent,
  STATUS_LABELS,
  ORIENTATION_LABELS,
  type CartLine,
  type Product,
} from '@bmb/shared';
import { HttpError } from '../http';
import { listProducts, loadCart } from '../services/catalogService';
import { getOrder } from '../services/orderService';

export interface AssistantTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: S;
  mutates: boolean;
  handler: (input: z.output<S>) => Promise<unknown>;
}

function defineTool<S extends z.ZodType>(t: AssistantTool<S>): AssistantTool<S> {
  return t;
}

async function contextFor(cart: z.infer<typeof cartSchema>) {
  const { box, lines } = await loadCart(cart);
  const catalog = await listProducts();
  const quantities = Object.fromEntries(lines.map((l) => [l.product.id, l.quantity]));
  const result = packCart(box, lines);
  const additions = checkAdditions(
    box,
    lines,
    catalog.map((p) => ({ product: p })),
  );
  return { box, lines, catalog, quantities, result, additions };
}

const brief = (p: Product) => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  category: p.category,
  priceCents: p.priceCents,
  available: p.available,
  weight: formatWeight(p.weightG),
});

export const assistantTools = [
  defineTool({
    name: 'search_products',
    description: 'Busca productos activos del catálogo y su stock disponible.',
    input: z.object({ query: z.string().max(80).optional(), category: z.string().max(60).optional() }),
    mutates: false,
    handler: async ({ query, category }) => (await listProducts({ search: query, category })).map(brief),
  }),
  defineTool({
    name: 'get_box_contents',
    description: 'Resume el contenido de una caja: productos, peso, espacio y estado del acomodo.',
    input: cartSchema,
    mutates: false,
    handler: async (cart) => {
      const { box, lines, result } = await contextFor(cart);
      return {
        box: box.name,
        status: STATUS_LABELS[result.status],
        weight: `${formatWeight(result.totals.weightG)} de ${formatWeight(result.totals.usableWeightG)} útiles`,
        estimatedSpaceUsed: formatPercent(result.totals.volumeUtilization),
        items: lines.map((l) => ({ name: l.product.name, quantity: l.quantity })),
        requiresReview: result.requiresReview,
        reviewReasons: result.reviewReasons,
      };
    },
  }),
  defineTool({
    name: 'explain_fit',
    description: 'Explica si un producto cabe en la caja actual y, si no, por qué (según el motor de packing).',
    input: cartSchema.extend({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50).default(1) }),
    mutates: false,
    handler: async ({ productId, quantity, ...cart }) => {
      const { box, lines, catalog } = await contextFor(cart);
      const product = catalog.find((p) => p.id === productId);
      if (!product) throw new HttpError(404, 'Producto no encontrado');
      const inCart = lines.find((l) => l.product.id === productId)?.quantity ?? 0;
      if (product.available < inCart + quantity) {
        return { fits: false, reason: 'OUT_OF_STOCK', message: `Solo hay ${product.available} unidades disponibles de ${product.name}.` };
      }
      const r = checkAdditions(box, lines, [{ product, quantity }])[productId];
      return { fits: r.fits, reason: r.code ?? null, message: r.fits ? `${product.name} cabe en la caja.` : r.message };
    },
  }),
  defineTool({
    name: 'recommend_fitting_products',
    description: 'Lista productos con stock que todavía caben en la caja, empezando por los más pequeños.',
    input: cartSchema.extend({ limit: z.number().int().min(1).max(20).default(5) }),
    mutates: false,
    handler: async ({ limit, ...cart }) => {
      const ctx = await contextFor(cart);
      return smallFittingProducts(ctx, limit).map(brief);
    },
  }),
  defineTool({
    name: 'recommend_substitutes',
    description: 'Sugiere sustitutos (misma categoría, con stock y que caben) para un producto agotado o que no cabe.',
    input: cartSchema.extend({ productId: z.string().min(1), limit: z.number().int().min(1).max(10).default(3) }),
    mutates: false,
    handler: async ({ productId, limit, ...cart }) => {
      const ctx = await contextFor(cart);
      const product = ctx.catalog.find((p) => p.id === productId);
      if (!product) throw new HttpError(404, 'Producto no encontrado');
      return findSubstitutes(product, ctx, limit).map(brief);
    },
  }),
  defineTool({
    name: 'suggest_best_fill',
    description: 'Propone (sin aplicarla) una combinación de productos para aprovechar el espacio restante de la caja.',
    input: cartSchema.extend({ maxUnits: z.number().int().min(1).max(40).default(15) }),
    mutates: false,
    handler: async ({ maxUnits, ...cart }) => {
      const { box, lines, catalog } = await contextFor(cart);
      const s = suggestFill(
        box,
        lines as CartLine[],
        catalog.map((p) => ({ product: p, available: p.available })),
        { maxUnits },
      );
      return {
        proposal: s.added.map((a) => ({ productId: a.product.id, name: a.product.name, quantity: a.quantity })),
        resultingStatus: STATUS_LABELS[s.result.status],
        resultingWeight: formatWeight(s.result.totals.weightG),
        note: 'Es solo una propuesta: el cliente debe confirmar antes de agregar nada.',
      };
    },
  }),
  defineTool({
    name: 'prepare_picking_list',
    description: 'Prepara la lista de picking del almacén para una orden (por capas, en orden de empaque).',
    input: z.object({ orderId: z.string().min(1) }),
    mutates: false,
    handler: async ({ orderId }) => {
      const o = await getOrder(orderId);
      return {
        order: o.numberLabel,
        box: o.box.name,
        pick: o.items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
        layers: placementsByLayer(o.packingPlan).map((l) => ({
          layer: l.layer,
          units: l.placements.map((p) => `${p.name} (${ORIENTATION_LABELS[p.orientation] ?? p.rotationLabel})`),
        })),
        instructions: packingInstructions(o.packingPlan),
      };
    },
  }),
] as const;

export function listToolDefinitions() {
  return assistantTools.map((t) => ({
    name: t.name,
    description: t.description,
    mutates: t.mutates,
    inputSchema: z.toJSONSchema(t.input, { io: 'input' }),
  }));
}

export async function runTool(name: string, rawInput: unknown, opts: { humanApproval?: boolean } = {}) {
  const tool = assistantTools.find((t) => t.name === name) as AssistantTool | undefined;
  if (!tool) throw new HttpError(404, `Herramienta desconocida: ${name}`);
  if (tool.mutates && !opts.humanApproval) {
    throw new HttpError(403, 'Esta herramienta modifica datos y requiere aprobación humana explícita');
  }
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw new HttpError(400, 'Entrada inválida para la herramienta', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return tool.handler(parsed.data);
}
