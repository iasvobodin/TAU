import type { FastifyInstance } from "fastify";
// import type { Specification } from '../models/interfaces';
import { Prisma, type Specification } from "../../shared/src";
export default function specificationRoutes(app: FastifyInstance) {
  app.get("/specifications", async (request, reply) => {
    try {
      const specifications = await app.prisma.specification.findMany({
        include: {
          template: true,
          test: true,
          operation: true,
          checkList: true,
        },
      });
      reply.send(specifications);
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/specifications/:productMP", async (request, reply) => {
    try {
      const { productMP } = request.params as { productMP: string };
      const specification = await app.prisma.specification.findUnique({
        where: { productMP },
      });
      if (specification) {
        reply.send(specification);
      } else {
        reply.code(404).send({ error: "Specification not found" });
      }
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.post<{ Body: Specification }>(
    "/specifications",
    async (request, reply) => {
      try {
        const data = request.body;
        const specification = await app.prisma.specification.create({ data });
        reply.code(201).send(specification);
      } catch (error) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.put<{ Params: { id: number }; Body: Specification }>(
    "/specifications/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const specification = await app.prisma.specification.update({
          where: { id },
          data,
        });
        reply.send(specification);
      } catch (error) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.delete("/specifications/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: number };
      await app.prisma.specification.delete({
        where: { id },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });
}
