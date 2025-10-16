// src/utils/validate.ts
import { type FastifyRequest, type FastifyReply } from "fastify";

export function validateRequest() {
  return async (_req: FastifyRequest, _reply: FastifyReply) => {
    // ничего не делаем
  };
}
