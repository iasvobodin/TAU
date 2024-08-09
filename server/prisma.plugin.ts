import fp from 'fastify-plugin';
import { PrismaClient } from '../extensions/src';

// Функция для инициализации подключения к базе данных и создания экземпляра PrismaClient
async function initDatabaseConnection(): Promise<PrismaClient> {
  const db = new PrismaClient();
  await db.$connect(); // Установка соединения с базой данных
  return db;
}

// Использование TypeScript module augmentation для добавления типа PrismaClient к FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Fastify плагин для инициализации PrismaClient и его добавления к FastifyInstance
const prismaPlugin = fp(async (server) => {
  const prisma = await initDatabaseConnection(); // Инициализация PrismaClient

  // Декорирование FastifyInstance, чтобы сделать PrismaClient доступным через server.prisma
  server.decorate('prisma', prisma);

  // Добавление хука onClose для корректного отключения от базы данных при закрытии сервера
  server.addHook('onClose', async () => {
    await server.prisma.$disconnect(); // Отключение от базы данных при завершении работы сервера
  });
});

export default prismaPlugin;
