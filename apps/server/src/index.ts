import { createApp } from './app';
import { prisma } from './db';
import { env } from './env';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Build My Box API escuchando en http://localhost:${env.port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
