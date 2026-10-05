/**
 * Ciclo de vida de órdenes simuladas:
 *
 *   crear ──► PENDING_PAYMENT ──pagar──► PAID ──despachar──► FULFILLED
 *                   │                     │
 *                   └──────cancelar───────┴──► CANCELLED
 *
 * Stock: al crear se RESERVA (reserved += qty); al cancelar se LIBERA
 * (reserved -= qty); al despachar se CONSUME (stock -= qty, reserved -= qty).
 * Las reservas usan UPDATE condicionales para no sobrevender con concurrencia.
 */
import type { Order, OrderItem, Prisma } from '@prisma/client';
import {
  draftCustomsDeclaration,
  formatOrderNumber,
  packCart,
  type Box,
  type CreateOrderInput,
  type OrderDto,
  type OrderStatus,
  type PackingResult,
} from '@bmb/shared';
import { prisma } from '../db';
import { HttpError, notFound } from '../http';
import { getPaymentProvider } from '../payments';
import { assertStock, loadCart } from './catalogService';

type OrderWithItems = Order & { items: OrderItem[] };

export function toOrderDto(o: OrderWithItems): OrderDto {
  return {
    id: o.id,
    number: o.number,
    numberLabel: formatOrderNumber(o.number),
    status: o.status,
    box: o.boxSnapshot as unknown as Box,
    recipient: {
      name: o.recipientName,
      phone: o.recipientPhone,
      address: o.recipientAddress,
      city: o.recipientCity,
      province: o.recipientProvince,
      country: o.recipientCountry,
      notes: o.recipientNotes,
    },
    items: o.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      weightG: i.weightG,
    })),
    subtotalCents: o.subtotalCents,
    boxPriceCents: o.boxPriceCents,
    totalCents: o.totalCents,
    totalWeightG: o.totalWeightG,
    packingPlan: o.packingPlan as unknown as PackingResult,
    customsDeclaration: o.customsDeclaration,
    paymentProvider: o.paymentProvider,
    paymentReference: o.paymentReference,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    fulfilledAt: o.fulfilledAt?.toISOString() ?? null,
  };
}

const include = { items: true } as const;

export async function getOrder(id: string): Promise<OrderDto> {
  const o = await prisma.order.findUnique({ where: { id }, include });
  if (!o) throw notFound('Orden');
  return toOrderDto(o);
}

export async function listOrders(status?: OrderStatus): Promise<OrderDto[]> {
  const rows = await prisma.order.findMany({
    where: status ? { status } : {},
    include,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(toOrderDto);
}

export async function createOrder(input: CreateOrderInput): Promise<OrderDto> {
  if (input.items.length === 0) throw new HttpError(422, 'La caja está vacía');
  const { box, lines } = await loadCart(input);
  assertStock(lines);

  // El servidor vuelve a calcular el acomodo: nunca confía en el del cliente.
  const plan = packCart(box, lines);
  if (plan.status !== 'FITS') {
    throw new HttpError(422, 'Los productos no caben en la caja seleccionada', { status: plan.status, unplaced: plan.unplaced });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);
  const items = lines.map((l) => ({
    productId: l.product.id,
    sku: l.product.sku,
    name: l.product.name,
    quantity: l.quantity,
    unitPriceCents: l.product.priceCents,
    weightG: l.product.weightG,
  }));
  const r = input.recipient;

  const order = await prisma.$transaction(async (tx) => {
    for (const l of lines) {
      const n = await tx.$executeRaw`
        UPDATE "Product" SET "reserved" = "reserved" + ${l.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${l.product.id} AND "active" = true AND "stock" - "reserved" >= ${l.quantity}`;
      if (n !== 1) throw new HttpError(409, `Stock insuficiente para ${l.product.name}. Actualiza la caja e inténtalo de nuevo.`);
    }
    return tx.order.create({
      data: {
        status: 'PENDING_PAYMENT',
        boxId: box.id,
        boxSnapshot: box as unknown as Prisma.InputJsonValue,
        recipientName: r.name,
        recipientPhone: r.phone,
        recipientAddress: r.address,
        recipientCity: r.city,
        recipientProvince: r.province,
        recipientCountry: r.country,
        recipientNotes: r.notes,
        subtotalCents,
        boxPriceCents: box.priceCents,
        totalCents: subtotalCents + box.priceCents,
        totalWeightG: plan.totals.weightG,
        packingPlan: plan as unknown as Prisma.InputJsonValue,
        customsDeclaration: draftCustomsDeclaration(items, box),
        items: { create: items },
      },
      include,
    });
  });

  if (input.action === 'pay') return payOrder(order.id);
  return toOrderDto(order);
}

/** Checkout simulado: cobra con la pasarela configurada y marca la orden como pagada. */
export async function payOrder(id: string): Promise<OrderDto> {
  const order = await prisma.order.findUnique({ where: { id }, include });
  if (!order) throw notFound('Orden');
  if (order.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'La orden no está pendiente de pago');

  const provider = getPaymentProvider();
  const payment = await provider.createPayment({
    orderId: order.id,
    orderNumber: formatOrderNumber(order.number),
    amountCents: order.totalCents,
    currency: 'USD',
    description: `Build My Box ${formatOrderNumber(order.number)}`,
    customerName: order.recipientName,
  });
  if (payment.status !== 'succeeded') {
    throw new HttpError(402, payment.failureMessage ?? 'El pago no fue aprobado', { status: payment.status, clientSecret: payment.clientSecret });
  }
  return markOrderPaid(order.id, provider.name, payment.reference);
}

/** Punto único para marcar pagada (lo usará también el webhook de Stripe). */
export async function markOrderPaid(id: string, providerName: string, reference: string): Promise<OrderDto> {
  const n = await prisma.order.updateMany({
    where: { id, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID', paidAt: new Date(), paymentProvider: providerName, paymentReference: reference },
  });
  if (n.count !== 1) throw new HttpError(409, 'La orden no está pendiente de pago');
  return getOrder(id);
}

/** Cancela y libera el stock reservado. `allowPaid` solo para administración. */
export async function cancelOrder(id: string, { allowPaid }: { allowPaid: boolean }): Promise<OrderDto> {
  const allowed: OrderStatus[] = allowPaid ? ['PENDING_PAYMENT', 'PAID'] : ['PENDING_PAYMENT'];
  const before = await prisma.order.findUnique({ where: { id }, include });
  if (!before) throw notFound('Orden');

  await prisma.$transaction(async (tx) => {
    const n = await tx.order.updateMany({ where: { id, status: { in: allowed } }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    if (n.count !== 1) throw new HttpError(409, 'Esta orden ya no se puede cancelar');
    for (const it of before.items) {
      await tx.$executeRaw`
        UPDATE "Product" SET "reserved" = GREATEST(0, "reserved" - ${it.quantity}), "updatedAt" = NOW()
        WHERE "id" = ${it.productId}`;
    }
  });

  if (before.status === 'PAID' && before.paymentReference) {
    await getPaymentProvider().refund(before.paymentReference, before.totalCents);
  }
  return getOrder(id);
}

/** Despacho: consume el stock reservado. */
export async function fulfillOrder(id: string): Promise<OrderDto> {
  const before = await prisma.order.findUnique({ where: { id }, include });
  if (!before) throw notFound('Orden');
  await prisma.$transaction(async (tx) => {
    const n = await tx.order.updateMany({ where: { id, status: 'PAID' }, data: { status: 'FULFILLED', fulfilledAt: new Date() } });
    if (n.count !== 1) throw new HttpError(409, 'Solo se pueden despachar órdenes pagadas');
    for (const it of before.items) {
      await tx.$executeRaw`
        UPDATE "Product" SET "stock" = GREATEST(0, "stock" - ${it.quantity}),
          "reserved" = GREATEST(0, "reserved" - ${it.quantity}), "updatedAt" = NOW()
        WHERE "id" = ${it.productId}`;
    }
  });
  return getOrder(id);
}

export async function updateCustoms(id: string, customsDeclaration: string): Promise<OrderDto> {
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o) throw notFound('Orden');
  if (o.status === 'FULFILLED' || o.status === 'CANCELLED') {
    throw new HttpError(409, 'La declaración ya no se puede editar en esta orden');
  }
  await prisma.order.update({ where: { id }, data: { customsDeclaration } });
  return getOrder(id);
}
