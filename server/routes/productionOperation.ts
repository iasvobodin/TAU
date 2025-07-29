import type { FastifyInstance } from "fastify";
import type { Prisma, ProductionOperation } from "../../shared/src";
import type { StageType } from "../../frontend/src/assets/interfaces";
import { handlePrismaError } from "../handleError";

export default function productionOperationRoutes(app: FastifyInstance) {
  app.get("/production-operations", async (request, reply) => {
    try {
      const productionOperations =
        await app.prisma.productionOperation.findMany();
      reply.send(productionOperations);
    } catch (error) {
      handlePrismaError(error, reply);
      // reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/failed-production-operations", async (request, reply) => {
    try {
      const productionOperations =
        await app.prisma.productionOperation.findMany({
          where: {
            status: "on_hold",
          },
        });
      reply.send(productionOperations);
    } catch (error) {
      handlePrismaError(error, reply);
      // reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/production-operations/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const productionOperation =
        await app.prisma.productionOperation.findUnique({
          where: { id: parseInt(id) },
        });
      if (productionOperation) {
        reply.send(productionOperation);
      } else {
        reply.code(404).send({ error: "productionOperation not found" });
      }
    } catch (error) {
      handlePrismaError(error, reply);
      // console.log(error);

      // reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get(
    "/production-operations/productSN/:productSN",
    async (request, reply) => {
      try {
        const { productSN } = request.params as { productSN: string };
        const productionOperation =
          await app.prisma.productionOperation.findMany({
            where: { productSN },
          });
        if (productionOperation.length > 0) {
          reply.send(productionOperation);
        } else {
          reply.code(404).send({ error: "Операции не найдены" });
        }
      } catch (error) {
        handlePrismaError(error, reply);
        // console.log(error);

        // reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.post<{ Body: ProductionOperation }>(
    "/production-operations-failed",
    async (request, reply) => {
      try {
        const data = request.body;
        const productionOperation = await app.prisma.productionOperation.create(
          {
            data: {
              component: {
                connect: { snComponent: data.componentId! },
              },
              stageType: data.stageType as StageType, // issue preProdaction assembly marking functionalTest verification package
              status: data.status,
              comment: data.comment,
              productSN: data.productSN,
              user: data.user,
              usedComponents: data.usedComponents, // passed accepted defective shipped
            },
          }
        );
        reply.code(201).send(productionOperation);
      } catch (error) {
        handlePrismaError(error, reply);
        // console.log(error);
        // reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.post<{ Body: Prisma.ProductionOperationUncheckedCreateInput }>(
    "/production-operations-passed",
    async (request, reply) => {
      try {
        const data = request.body;
        console.log(data);

        if (
          !data.stageType ||
          !data.productId ||
          !data.status ||
          !data.usedComponents ||
          !data.user
        ) {
          throw new Error("Missing required fields");
        }
        // console.log(data);

        const productionOperation = await app.prisma.productionOperation.create(
          {
            data: {
              productId: data.productId,
              stageType: data.stageType,
              status: data.status,
              user: data.user,
              comment: data.comment,
              usedComponents: data.usedComponents,
              date: data.date ? new Date(data.date) : undefined, // ✅ добавлено
            },
          }
        );
        reply.code(201).send(productionOperation);
      } catch (error) {
        handlePrismaError(error, reply);
        // console.log(error);
        // reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.put<{
    Params: { id: string };
    Body: Prisma.ProductionOperationUncheckedUpdateInput;
  }>("/production-operations/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const data = request.body;
      const productionOperation = await app.prisma.productionOperation.update({
        where: { id: parseInt(id) },
        data,
      });
      reply.send(productionOperation);
    } catch (error) {
      handlePrismaError(error, reply);
      // reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.delete("/production-operations/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      // console.log(id, "IDIDIDIDIDIDIDIDIDIDID");

      await app.prisma.productionOperation.delete({
        where: { id: parseInt(id) },
      });
      reply.code(201).send({ message: "Object deleted" });
    } catch (error) {
      handlePrismaError(error, reply);
      // console.log(error);
      // reply.code(500).send({ error: "Internal Server Error" });
    }
  });
}
