import type { FastifyInstance } from "fastify";
import { type Prisma } from "../../shared/src";

export default function operatorRoutes(app: FastifyInstance) {
  app.get("/users", async (request, reply) => {
    try {
      const operators = await app.prisma.user.findMany();
      reply.send(operators);
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/users/:Login", async (request, reply) => {
    try {
      const { Login } = request.params as { Login: string };
      const operator = await app.prisma.user.findUnique({
        where: { Login },
      });
      if (operator) {
        reply.send(operator);
      } else {
        reply.code(404).send({ error: "Operator not found" });
      }
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.post<{ Body: Prisma.UserCreateInput }>(
    "/users",
    async (request, reply) => {
      try {
        const data = request.body;
        const operator = await app.prisma.user.create({ data });
        reply.code(201).send(operator);
      } catch (error) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.put<{ Params: { Login: string }; Body: Prisma.UserUpdateInput }>(
    "/users/:Login",
    async (request, reply) => {
      try {
        const { Login } = request.params as { Login: string };
        const data = request.body;
        const operator = await app.prisma.user.update({
          where: { Login },
          data,
        });
        reply.send(operator);
      } catch (error) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.delete("/users/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: number };
      await app.prisma.user.delete({
        where: { id },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });
}
