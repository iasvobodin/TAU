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

    reply.type("text/html; charset=utf-8").send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Авторизация</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .message-box {
      background: white;
      padding: 2rem 3rem;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      text-align: center;
      max-width: 400px;
      animation: fadeIn 0.8s ease-out;
    }
    h1 {
      font-size: 1.5rem;
      color: #333;
      margin: 0;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="message-box">
    <h1>Авторизация прошла успешно.<br>Можете закрыть это окно.</h1>
  </div>
</body>
</html>
`);
  });
}
