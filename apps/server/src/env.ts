/** Configuración del servidor desde variables de entorno (ver .env.example). */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Token simple para el panel de administración (MVP; reemplazar por auth real). */
  adminToken: process.env.ADMIN_TOKEN ?? 'admin-demo',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
};

if (env.adminToken === 'admin-demo' && env.nodeEnv === 'production') {
  console.warn('[seguridad] ADMIN_TOKEN usa el valor por defecto. Configúralo antes de desplegar.');
}
