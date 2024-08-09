import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyServerOptions } from "fastify";
import prismaPlugin from "./prisma.plugin";
export type AppOptions = Partial<FastifyServerOptions>;

async function buildApp(options: AppOptions = {}) {
  const fastify = Fastify(options);
  fastify.register(prismaPlugin);
  fastify.register(cors, {
    origin: "*",
    methods: ["POST", "GET", "PUT", "DELETE"],
  });

  return fastify;
}

export { buildApp };
