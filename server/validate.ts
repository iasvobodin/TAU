import { type FastifyRequest, type FastifyReply } from "fastify";
import { ZodSchema } from "zod";

export function validateRequest(schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (schemas.body) request.body = schemas.body.parse(request.body);
      if (schemas.params) request.params = schemas.params.parse(request.params);
      if (schemas.query) request.query = schemas.query.parse(request.query);
    } catch (err: any) {
      reply.code(400).send({
        error: "Ошибка валидации",
        details: err.errors || err.message,
      });
    }
  };
}
