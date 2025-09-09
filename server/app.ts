import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyServerOptions } from "fastify";
import prismaPlugin from "./prisma.plugin";
import websocketPlugin from "@fastify/websocket";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "fs/promises";

// Расширяем AppOptions для передачи обязательных параметров Prisma
export interface AppOptions extends Partial<FastifyServerOptions> {
  data_model?: string; // Обязательное поле для Prisma
  log_level?: string; // Обязательное поле для Prisma
  enableTracing?: boolean; // Обязательное поле из ошибки
}

async function buildApp(options: AppOptions = {}) {
  // const fastify = Fastify({
  //   logger: options.logger || false, // По умолчанию false, если не указано
  // });
  const fastify = Fastify({
    logger: options.logger
      ? {
          level: options.log_level || "info",
          transport: { target: "pino-pretty", options: { colorize: true } },
        }
      : false,
  });
  // Передаём опции в prismaPlugin
  await fastify.register(prismaPlugin, {
    data_model: options.data_model || "default_model",
    log_level: options.log_level || "info",
    enableTracing: options.enableTracing ?? false, // false по умолчанию
  });

  await fastify.register(websocketPlugin);
  await fastify.register(cors, {
    origin: "*",
    methods: ["POST", "GET", "PUT", "DELETE"],
  });

  const uploadDir = new URL("./uploads", import.meta.url).pathname;

  await fastify.register(fastifyMultipart);
  await fastify.register(fastifyStatic, {
    // root: path.join(process.cwd(), "uploads"),
    root: uploadDir,
    prefix: "/uploads/",
  });

  return fastify;
}

export { buildApp };
