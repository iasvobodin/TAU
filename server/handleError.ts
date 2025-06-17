import type { FastifyReply } from "fastify";
import { Prisma } from "../shared/src";

export const handlePrismaError = (error: unknown, reply: FastifyReply) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    reply.code(500).send({
      error: error.message,
      code: error.code,
      meta: error.meta,
    });
  } else if (error instanceof Error) {
    reply.code(500).send({ error: error.message });
  } else {
    reply.code(500).send({ error: "Unknown error" });
  }
};
