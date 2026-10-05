import { Router } from 'express';
import { listToolDefinitions, runTool } from '../assistant/tools';

/**
 * Endpoints para un futuro asistente. Hoy solo exponen herramientas de lectura;
 * ninguna puede modificar inventario, órdenes ni pagos.
 */
export const assistantRouter = Router();

assistantRouter.get('/tools', (_req, res) => {
  res.json(listToolDefinitions());
});

assistantRouter.post('/tools/:name', async (req, res) => {
  res.json({ tool: req.params.name, result: await runTool(req.params.name, req.body?.input) });
});
