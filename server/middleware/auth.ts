// src/middleware/auth.ts
import type { FastifyInstance } from "fastify";

const API_KEY = process.env.API_KEY || "your-secret-api-key-12345";
const PUBLIC_ROUTES = ["/pid", "/ws", "/health", "/callback"];

export function authMiddleware(app: FastifyInstance) {
  if (!API_KEY) {
    throw new Error("API_KEY environment variable is required");
  }

  app.addHook("preHandler", async (request, reply) => {
    // Пропускаем публичные роуты
    if (PUBLIC_ROUTES.some((route) => request.url.startsWith(route))) {
      return;
    }

    const clientApiKey = request.headers["x-api-key"];

    if (!clientApiKey || clientApiKey !== API_KEY) {
      reply.code(403).send({
        error: "Access denied: invalid API key",
        code: "INVALID_API_KEY",
      });
      return;
    }
  });
}
