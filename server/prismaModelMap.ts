import type { PrismaClient } from "@prisma/client";

export const modelMap = {
  checkList: (prisma: PrismaClient) => prisma.checkList,
  test: (prisma: PrismaClient) => prisma.test,
  product: (prisma: PrismaClient) => prisma.product,
  specification: (prisma: PrismaClient) => prisma.specification,
  template: (prisma: PrismaClient) => prisma.template,
  defectHistory: (prisma: PrismaClient) => prisma.defectHistory,
  // добавь другие модели по мере необходимости
} as const;

export type ModelName = keyof typeof modelMap;
