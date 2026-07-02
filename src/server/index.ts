import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth';
import { prisma } from './db';

const PORT = Number(process.env.PORT) || 3001;

async function build() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'supersecret',
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  await fastify.register(authRoutes, { prefix: '/api' });

  return fastify;
}

async function start() {
  const app = await build();

  try {
    await app.listen({ port: PORT });
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();