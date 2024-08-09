import type { FastifyInstance } from "fastify";
// import type { Component } from '../models/interfaces';
import { type Component, Prisma } from "../../extensions/src";

export default function componentRoutes(app: FastifyInstance) {
  app.get("/components", async (request, reply) => {
    try {
      const components = await app.prisma.component.findMany({
        include: {
          pnComponent: {
            select: {
              partNumber: true,
              descriptionRU: true,
            },
          },
          ProductionOperation: true,
        },
      });
      reply.send(components);
    } catch (error) {
      reply.code(500).send({ error: "Failed to fetch components" });
    }
  });

  app.get("/components/:snComponent", async (request, reply) => {
    try {
      const { snComponent } = request.params as { snComponent: string };
      const component = await app.prisma.component.findUnique({
        where: { snComponent },
        include: {
          ProductionOperation: true,
        },
      });
      if (component) {
        reply.send(component);
      } else {
        reply.code(404).send({ error: "Component not found" });
      }
    } catch (error) {
      reply.code(500).send({ error: "Failed to fetch component" });
    }
  });

  app.post<{ Body: Prisma.ComponentUncheckedCreateInput }>(
    "/components",
    async (request, reply) => {
      try {
        const data = request.body;
        if (
          !data.snComponent ||
          !data.pnComponentId ||
          !data.supplier ||
          !data.invoice ||
          !data.status ||
          !data.comment ||
          !data.user
        ) {
          throw new Error("Missing required fields");
        }
        const component = await app.prisma.component.create({
          data: {
            pnComponent: {
              connect: { partNumber: data.pnComponentId },
            },
            snComponent: data.snComponent,
            supplier: data.supplier,
            invoice: data.invoice,
            status: data.status,
            comment: data.comment,
            user: data.user,
          },
        });
        reply.code(201).send(component);
      } catch (error: any) {
        console.log(error);

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          reply
            .code(409)
            .send({ error: "Компонент с таким значением уже существует." });
        } else {
          reply
            .code(500)
            .send({
              error:
                "Произошла ошибка при создании компонента: " + error.message,
            });
        }
      }
    }
  );

  app.put<{
    Params: { snComponent: string };
    Body: Prisma.ComponentUncheckedUpdateInput;
  }>("/components/:snComponent", async (request, reply) => {
    try {
      const { snComponent } = request.params;
      const data = request.body;
      const component = await app.prisma.component.update({
        where: { snComponent },
        data,
      });
      reply.send(component);
    } catch (error) {
      reply.code(500).send({ error: "Failed to update component" });
    }
  });

  app.delete("/components/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: number };
      await app.prisma.component.delete({
        where: { id },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: "Failed to delete component" });
    }
  });
}
