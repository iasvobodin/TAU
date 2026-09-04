// src/utils/crudGenerator.ts
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { modelMap, type ModelName } from "./prismaModelMap";

interface CrudOptions {
  app: FastifyInstance;
  modelName: ModelName;
  path: string;
  uniqueKey: string | number;
}

/**
 * Приводит значение параметра маршрута к типу, ожидаемому Prisma.
 * req.params всегда содержит строки; числовые ключи (например, id) Prisma
 * ожидает как Int, поэтому «числовые» значения приводим к Number, а
 * строковые ключи (например, partNumber) оставляем строками.
 */
function coerceWhereValue(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value;
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
    const { [uniqueKey]: rawValue } = req.params as Record<string, string>;
    const data = await model.findUnique({
      where: { [uniqueKey]: coerceWhereValue(rawValue) },
    });
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

  app.put(`${path}/:${uniqueKey}`, async (req: any, reply) => {
    const { [uniqueKey]: id } = req.params; // Извлекаем id по имени ключа

    const result = await model.update({
      where: {
        // Приводим к числу только само значение ID
        [uniqueKey]: coerceWhereValue(id),
      },
      data: req.body,
    });
    reply.send(result);
  });

  app.delete(`${path}/:${uniqueKey}`, async (req, reply) => {
    const { [uniqueKey]: rawValue } = req.params as Record<string, string>;
    await model.delete({ where: { [uniqueKey]: coerceWhereValue(rawValue) } });
    reply.code(204).send();
  });
}
