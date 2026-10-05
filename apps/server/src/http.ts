import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

/** Error HTTP con mensaje en español y detalles opcionales para el cliente. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} no encontrado`);

/** Valida con Zod y lanza 400 con la lista de problemas si no es válido. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(
      400,
      'Datos inválidos',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con ese valor único', details: err.meta });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
};
