import type { FastifyInstance } from "fastify";
import { createCrudRoutes } from "../crudGenerator";

export default function defectHistoryRoutes(app: FastifyInstance) {
  createCrudRoutes({
    app,
    modelName: "defectHistory",
    path: "/defect-history",
    uniqueKey: "componentSN",
  });

  app.get("/defect-history-all", async (request, reply) => {
    try {
      const defectHistory = await app.prisma.defectHistory.findMany({
        include: {
          component: {
            include: {
              pnComponent: true,
            },
          },
        },
      });
      reply.send(defectHistory);
    } catch (error) {
      console.log(error);
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.delete("/defect-history-del/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await app.prisma.defectHistory.delete({
        where: { id: parseInt(id) },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({
        error: `${JSON.stringify(error)}"Failed to delete defect"`,
      });
    }
  });
}
