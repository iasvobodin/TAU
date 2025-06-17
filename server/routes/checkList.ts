import type { FastifyInstance } from "fastify";
import { type CheckList, Prisma } from "../../shared/src";

export default function checkListRoutes(app: FastifyInstance) {
  app.get("/check-list", async (request, reply) => {
    try {
      const checkLists = await app.prisma.checkList.findMany();
      reply.send(checkLists);
    } catch (error) {
      reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.get("/check-list/:productMP", async (request, reply) => {
    try {
      const { productMP } = request.params as { productMP: string };
      const checkList = await app.prisma.checkList.findUnique({
        where: { productMP },
      });
      if (checkList) {
        reply.send(checkList);
      } else {
        reply.code(404).send({ error: "checkList not found" });
      }
    } catch (error) {
      reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.post<{ Body: CheckList }>("/check-list", async (request, reply) => {
    try {
      const data = request.body;
      const checkList = await app.prisma.checkList.create({ data });
      reply.code(201).send(checkList);
    } catch (error) {
      reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.put<{ Params: { productMP: string }; Body: CheckList }>(
    "/check-list/:productMP",
    async (request, reply) => {
      try {
        const { productMP } = request.params;
        const data = request.body;
        const checkList = await app.prisma.checkList.update({
          where: { productMP },
          data,
        });
        reply.send(checkList);
      } catch (error) {
        reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  app.delete("/check-list/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: number };
      await app.prisma.checkList.delete({
        where: { id },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: "Internal server error" });
    }
  });
}
