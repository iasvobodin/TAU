import type { FastifyInstance } from "fastify";
import type { Prisma, Product } from "../../shared/src";

export default function productRoutes(app: FastifyInstance) {
  app.get("/products", async (request, reply) => {
    try {
      const products = await app.prisma.product.findMany({
        include: {
          specification: {
            include: {
              test: true,
              checkList: true,
              template: true,
              operation: {
                select: {
                  marking: true,
                  assembly: true,
                  functionalTest: true,
                  package: true,
                },
              },
            },
          },
          productionOperations: {},
        },
      });
      reply.send(products);
    } catch (error) {
      console.log(error);

      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/productlastsn", async (request, reply) => {
    try {
      const products = await app.prisma.product.findMany({
        orderBy: {
          id: "desc",
        },
        take: 1,
        select: {
          snProduct: true,
        },
      });

      reply.send(products);
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  const productInclude: Prisma.ProductInclude = {
    specification: {
      include: {
        test: true,
        template: true,
        operation: true,
        checkList: true,
      },
    },
    productionOperations: true,
    components: true,
  };

  app.get("/products/:snProduct", async (request, reply) => {
    try {
      const { snProduct } = request.params as { snProduct: string };
      console.log(snProduct, "snProduct");

      const product = await app.prisma.product.findUnique({
        where: { snProduct },
        include: productInclude,
      });
      if (product) {
        reply.send(product);
      } else {
        reply.code(404).send({ error: "Product not found" });
      }
    } catch (error) {
      console.log(error);

      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.get(
    "/products/orderToProduction/:orderToProduction",
    async (request, reply) => {
      try {
        const { orderToProduction } = request.params as {
          orderToProduction: string;
        }; // получаем параметр из URL
        console.log(orderToProduction, "orderToProduction");

        const products = await app.prisma.product.findMany({
          where: { orderToProduction }, // фильтрация по полю orderToProduction
          include: productInclude, // включает связанные данные, как в вашем примере
        });

        if (products.length > 0) {
          reply.send(products);
        } else {
          reply.code(404).send({ error: "Продукты не найдены" });
        }
      } catch (error) {
        console.log(error);

        reply.code(500).send({ error: "Внутренняя ошибка сервера" });
      }
    }
  );

  app.post<{ Body: Product }>("/products", async (request, reply) => {
    try {
      const data = request.body;
      if (!data.snProduct || !data.specificationProductMP) {
        throw new Error("Missing required fields");
      }
      const product = await app.prisma.product.create({ data });
      reply.code(201).send(product);
    } catch (error: any) {
      console.log(error.message);

      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  app.put<{ Params: { snProduct: string }; Body: Product }>(
    "/products/:snProduct",
    async (request, reply) => {
      try {
        const { snProduct } = request.params;
        const data = request.body;
        const product = await app.prisma.product.update({
          where: { snProduct },
          data,
        });
        reply.send(product);
      } catch (error) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  app.delete("/products/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await app.prisma.product.delete({
        where: { id: parseInt(id) },
      });
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });
}
