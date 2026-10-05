import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { boxInputSchema, productInputSchema, stockAdjustSchema, type OrderStatus } from '@bmb/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError, parse } from '../http';
import { toBox, toProduct } from '../mappers';
import { listBoxes, listProducts } from '../services/catalogService';
import { cancelOrder, fulfillOrder, getOrder, listOrders, payOrder } from '../services/orderService';

/** Autenticación mínima del MVP: header `x-admin-token`. Sustituir por auth real. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const given = Buffer.from(String(req.header('x-admin-token') ?? ''));
  const expected = Buffer.from(env.adminToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, 'Acceso de administrador requerido');
  }
  next();
};

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/verify', (_req, res) => {
  res.json({ ok: true });
});

// --- Productos -----------------------------------------------------------------

adminRouter.get('/products', async (_req, res) => {
  res.json(await listProducts({ includeInactive: true }));
});

adminRouter.post('/products', async (req, res) => {
  const data = parse(productInputSchema, req.body);
  res.status(201).json(toProduct(await prisma.product.create({ data })));
});

adminRouter.put('/products/:id', async (req, res) => {
  const data = parse(productInputSchema, req.body);
  const current = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!current) throw new HttpError(404, 'Producto no encontrado');
  if (data.stock < current.reserved) {
    throw new HttpError(409, `El stock no puede ser menor que lo reservado por órdenes activas (${current.reserved})`);
  }
  res.json(toProduct(await prisma.product.update({ where: { id: req.params.id }, data })));
});

adminRouter.patch('/products/:id/stock', async (req, res) => {
  const { stock } = parse(stockAdjustSchema, req.body);
  const current = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!current) throw new HttpError(404, 'Producto no encontrado');
  if (stock < current.reserved) {
    throw new HttpError(409, `El stock no puede ser menor que lo reservado por órdenes activas (${current.reserved})`);
  }
  res.json(toProduct(await prisma.product.update({ where: { id: req.params.id }, data: { stock } })));
});

adminRouter.delete('/products/:id', async (req, res) => {
  const used = await prisma.orderItem.count({ where: { productId: req.params.id } });
  if (used > 0) throw new HttpError(409, 'El producto tiene órdenes asociadas: desactívalo en lugar de eliminarlo');
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Cajas -----------------------------------------------------------------------

adminRouter.get('/boxes', async (_req, res) => {
  res.json(await listBoxes(true));
});

adminRouter.post('/boxes', async (req, res) => {
  const data = parse(boxInputSchema, req.body);
  res.status(201).json(toBox(await prisma.box.create({ data })));
});

adminRouter.put('/boxes/:id', async (req, res) => {
  const data = parse(boxInputSchema, req.body);
  res.json(toBox(await prisma.box.update({ where: { id: req.params.id }, data })));
});

adminRouter.delete('/boxes/:id', async (req, res) => {
  const used = await prisma.order.count({ where: { boxId: req.params.id } });
  if (used > 0) throw new HttpError(409, 'La caja tiene órdenes asociadas: desactívala en lugar de eliminarla');
  await prisma.box.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Órdenes ---------------------------------------------------------------------

const statusSchema = z.object({ status: z.enum(['PENDING_PAYMENT', 'PAID', 'FULFILLED', 'CANCELLED']).optional() });

adminRouter.get('/orders', async (req, res) => {
  const { status } = parse(statusSchema, req.query);
  res.json(await listOrders(status as OrderStatus | undefined));
});

adminRouter.get('/orders/:id', async (req, res) => {
  res.json(await getOrder(req.params.id));
});

adminRouter.post('/orders/:id/pay', async (req, res) => {
  res.json(await payOrder(req.params.id));
});

adminRouter.post('/orders/:id/cancel', async (req, res) => {
  res.json(await cancelOrder(req.params.id, { allowPaid: true }));
});

adminRouter.post('/orders/:id/fulfill', async (req, res) => {
  res.json(await fulfillOrder(req.params.id));
});
