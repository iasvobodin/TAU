// src/utils/crudGenerator.ts
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { modelMap, type ModelName } from "./prismaModelMap";

interface CrudOptions {
  app: FastifyInstance;
  modelName: ModelName;
  path: string;
  uniqueKey: string;
}

export function createCrudRoutes({
  app,
  modelName,
  path,
  uniqueKey,
}: CrudOptions) {
  const model = modelMap[modelName](app.prisma);

  app.get(path, async (_, reply) => {
    const result = await model.findMany();
    reply.send(result);
  });

  app.get(`${path}/:${uniqueKey}`, async (req, reply) => {
    const data = await model.findUnique({ where: req.params });
    if (data) {
      reply.send(data);
    } else {
      reply.code(404).send({ error: "Не найдено" });
    }
  });

  app.post(path, async (req, reply) => {
    const result = await model.create({ data: req.body });
    reply.code(201).send(result);
  });

  app.put(`${path}/:${uniqueKey}`, async (req, reply) => {
    const result = await model.update({ where: req.params, data: req.body });
    reply.send(result);
  });

  app.delete(`${path}/:${uniqueKey}`, async (req, reply) => {
    await model.delete({ where: req.params });
    reply.code(204).send();
  });
}
