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
}
