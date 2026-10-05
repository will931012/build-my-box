/**
 * Pruebas de la API que no requieren base de datos: validación de entradas,
 * autenticación de administración y guardas de las herramientas del asistente.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { assistantTools, listToolDefinitions, runTool } from '../src/assistant/tools';

const app = createApp();

describe('API', () => {
  it('rechaza órdenes con datos inválidos con mensajes en español', async () => {
    const res = await request(app).post('/api/orders').send({ boxId: 'x', items: [], recipient: { name: '' }, action: 'pay' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Datos inválidos');
    expect(res.body.details.some((d: { path: string }) => d.path === 'recipient.name')).toBe(true);
  });

  it('rechaza JSON mal formado', async () => {
    const res = await request(app).post('/api/packing/evaluate').set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
  });

  it('protege las rutas de administración', async () => {
    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
    expect((await request(app).get('/api/admin/orders').set('x-admin-token', 'incorrecto')).status).toBe(401);
  });

  it('devuelve 404 en JSON para rutas desconocidas de la API', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('herramientas del asistente', () => {
  it('todas son de solo lectura', () => {
    expect(assistantTools.every((t) => t.mutates === false)).toBe(true);
    expect(listToolDefinitions().every((d) => d.inputSchema && !d.mutates)).toBe(true);
  });

  it('rechaza herramientas desconocidas y entradas inválidas', async () => {
    await expect(runTool('borrar_inventario', {})).rejects.toMatchObject({ status: 404 });
    await expect(runTool('explain_fit', { boxId: '' })).rejects.toMatchObject({ status: 400 });
  });
});
