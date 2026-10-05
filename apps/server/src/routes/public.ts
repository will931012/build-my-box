import { Router } from 'express';
import { z } from 'zod';
import { cartSchema, checkAdditions, checkAdditionsSchema, createOrderSchema, customsSchema, packCart } from '@bmb/shared';
import { prisma } from '../db';
import { parse } from '../http';
import { toProduct } from '../mappers';
import { getActiveBox, listBoxes, listCategories, listProducts, loadCart } from '../services/catalogService';
import { cancelOrder, createOrder, getOrder, payOrder, updateCustoms } from '../services/orderService';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

publicRouter.get('/products', async (req, res) => {
  const q = parse(z.object({ search: z.string().max(80).optional(), category: z.string().max(60).optional() }), req.query);
  res.json(await listProducts(q));
});

publicRouter.get('/categories', async (_req, res) => {
  res.json(await listCategories());
});

publicRouter.get('/boxes', async (_req, res) => {
  res.json(await listBoxes());
});

/** Acomodo autoritativo calculado en el servidor. */
publicRouter.post('/packing/evaluate', async (req, res) => {
  const cart = parse(cartSchema, req.body);
  const { box, lines } = await loadCart(cart);
  res.json(packCart(box, lines));
});

/** Qué productos del catálogo caben si se agrega una unidad más. */
publicRouter.post('/packing/check-additions', async (req, res) => {
  const input = parse(checkAdditionsSchema, req.body);
  const box = await getActiveBox(input.boxId);
  const { lines } = input.items.length > 0 ? await loadCart(input) : { lines: [] };
  const where = input.candidateProductIds ? { id: { in: input.candidateProductIds }, active: true } : { active: true };
  const candidates = (await prisma.product.findMany({ where })).map(toProduct);
  res.json(checkAdditions(box, lines, candidates.map((product) => ({ product }))));
});

publicRouter.post('/orders', async (req, res) => {
  const input = parse(createOrderSchema, req.body);
  res.status(201).json(await createOrder(input));
});

publicRouter.get('/orders/:id', async (req, res) => {
  res.json(await getOrder(req.params.id));
});

publicRouter.post('/orders/:id/pay', async (req, res) => {
  res.json(await payOrder(req.params.id));
});

publicRouter.post('/orders/:id/cancel', async (req, res) => {
  res.json(await cancelOrder(req.params.id, { allowPaid: false }));
});

publicRouter.patch('/orders/:id/customs', async (req, res) => {
  const { customsDeclaration } = parse(customsSchema, req.body);
  res.json(await updateCustoms(req.params.id, customsDeclaration));
});
