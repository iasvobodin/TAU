import fp from "fastify-plugin";
import { PrismaClient } from "../shared/src";

// Интерфейс для параметров плагина
interface PrismaPluginOptions {
  data_model: string;
  log_level: string;
  enableTracing: boolean;
}

// Функция для инициализации подключения к базе данных
async function initDatabaseConnection(
  options: PrismaPluginOptions
): Promise<PrismaClient> {
  const db = new PrismaClient({
    // Укажи источник данных из переменных окружения
    // datasources: {
    //   db: { url: process.env.DATABASE_URL },
    // },
    // Логирование
    log: [{ level: options.log_level as any, emit: "event" }],
    // Внутренние параметры движка
    __internal: {
      engine: {
        enableTracing: options.enableTracing,
        dataModel: options.data_model,
      },
    },
  });
  await db.$connect(); // Установка соединения
  return db;
}

// Расширяем типы Fastify
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Fastify плагин
const prismaPlugin = fp(async (server, options: PrismaPluginOptions) => {
  const prisma = await initDatabaseConnection(options); // Передаём опции

  server.decorate("prisma", prisma);

  server.addHook("onClose", async () => {
    await server.prisma.$disconnect(); // Отключение при завершении
  });
});

export default prismaPlugin;
