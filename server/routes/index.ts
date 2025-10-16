// src/routes/index.ts
import type { FastifyInstance } from "fastify";
import componentRoutes from "./component";
import operationRoutes from "./operation";
import operatorRoutes from "./user";
import productRoutes from "./product";
import productionOperationRoutes from "./productionOperation";
import specificationRoutes from "./specification";
import templateRoutes from "./template";
import testRoutes from "./test";
import partNumberComponentRoutes from "./partNumberComponent";
import checkListRoutes from "./checkList";
import defectHistoryRoutes from "./defectHistory";
import imageRoutes from "./uploadImages";
import { activeClients, sendToClient } from "../websocket/websocketStore";

export function registerRoutes(app: FastifyInstance) {
  // Регистрация всех роутов
  componentRoutes(app);
  operationRoutes(app);
  operatorRoutes(app);
  productRoutes(app);
  productionOperationRoutes(app);
  specificationRoutes(app);
  templateRoutes(app);
  testRoutes(app);
  partNumberComponentRoutes(app);
  checkListRoutes(app);
  defectHistoryRoutes(app);
  imageRoutes(app);

  app.get("/pid", async (_, reply) => reply.send({ pid: process.pid }));

  // Health check endpoint
  app.get("/health", async (request, reply) => {
    reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  app.get("/clients", async (request, reply) => {
    // console.log(activeClients);

    // 1. Преобразование Map в массив записей [id, ActiveClientData]
    const clientList = Array.from(activeClients.entries()).map(
      // 2. Деструктурируем id (ключ) и client (значение)
      ([id, client]) => ({
        // 3. Создаем новый объект с нужными данными
        clientId: id,
        lastActive: client.lastActive, // 👈 Доступ к полю lastActive
        // Если бы у вас было поле userId, вы бы использовали:
        // userId: client.userId,
      })
    );

    // 4. Отправляем JSON-ответ
    reply.send({
      count: activeClients.size,
      clients: clientList,
    });
  });

  app.get("/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code) {
      reply.code(400).send("Missing code");
      return;
    }

    // console.log("Auth code:", code);

    let userId: string | undefined;

    if (state) {
      try {
        const stateObj = JSON.parse(atob(state));
        userId = stateObj.userId;
        console.log("userId из state:", userId);
      } catch (err) {
        console.error("Не удалось распарсить state:", err);
      }
    }

    // Здесь можно вызвать exchangeCode(code) и потом отправить токен конкретному клиенту:
    if (userId) sendToClient(userId, { command: "code", code });

    console.log(JSON.stringify({ type: "auth_code", code, userId }));

    reply
      .type("text/html; charset=utf-8")
      .send("<h1>Авторизация прошла успешно. Можете закрыть это окно.</h1>");
  });
}
