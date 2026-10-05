import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { env } from './env';
import { errorHandler, notFoundHandler } from './http';
import { adminRouter } from './routes/admin';
import { assistantRouter } from './routes/assistant';
import { publicRouter } from './routes/public';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/admin', adminRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api', publicRouter);
  app.use('/api', notFoundHandler);

  // En producción, sirve el frontend compilado (apps/web/dist) desde el mismo origen.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
