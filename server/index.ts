// src/server.ts
import { buildApp } from "./app";
import type { AppOptions } from "./app";
import componentRoutes from "./routes/component";
import operationRoutes from "./routes/operation";
import operatorRoutes from "./routes/operator";
import productRoutes from "./routes/product";
import productionOperationRoutes from "./routes/productionOperation";
import specificationRoutes from "./routes/specification";
import templateRoutes from "./routes/template";
import testRoutes from "./routes/test";
import partNumberComponentRoutes from "./routes/partNumberComponent";
import checkListRoutes from "./routes/checkList";
import { config } from "dotenv";

config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "localhost";

const options: AppOptions = {
  logger: true,
  data_model: process.env.DATA_MODEL || "default_model",
  log_level: process.env.LOG_LEVEL || "info",
  enableTracing: process.env.ENABLE_TRACING === "true" || false,
};

const API_KEY = "your-secret-api-key-12345";

const clients = new Map<
  string,
  { socket: any; clientId: string; lastActive: Date }
>();

const app = await buildApp(options);

app.addHook("preHandler", (request, reply, done) => {
  const publicRoutes = ["/pid", "/ws"];
  if (publicRoutes.includes(request.url)) {
    done();
    return;
  }
  const clientApiKey = request.headers["x-api-key"];
  if (!clientApiKey || clientApiKey !== API_KEY) {
    reply.code(403).send({ error: "Доступ запрещён: неверный API-ключ" });
    return;
  }
  done();
});

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

app.post("/shutdown", async (request, reply) => {
  const clientApiKey = request.headers["x-api-key"];
  if (!clientApiKey || clientApiKey !== API_KEY) {
    return reply
      .code(403)
      .send({ error: "Доступ запрещён: неверный API-ключ" });
  }

  clients.forEach((client) => {
    if (client.socket.readyState === 1) {
      client.socket.send(JSON.stringify({ command: "shutdown" }));
    }
  });
  reply.send({ message: "Команда shutdown отправлена всем клиентам" });
});

const startServer = async (port: number | undefined) => {
  app.get("/pid", async (request, reply) => {
    try {
      const pid = process.pid;
      reply.send({ pid });
    } catch (error) {
      reply.code(500).send({ error: "Error fetching PID" });
    }
  });

  app.get(
    "/ws",
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
      let clientId: string | null = null;

      socket.on("message", (message) => {
        try {
          const messageStr = message.toString();
          // Проверяем, является ли сообщение JSON
          let data;
          try {
            data = JSON.parse(messageStr);
          } catch {
            // Обработка текстовых сообщений для обратной совместимости
            if (messageStr === "Привет, сервер!") {
              socket.send(
                JSON.stringify({ command: "pid", value: process.pid })
              );
              console.log("Получено текстовое сообщение: Привет, сервер!");
              return;
            }
            throw new Error("Неверный формат сообщения");
          }

          console.log("Получено сообщение:", data);

          if (data.command === "appStarted") {
            clientId = data.clientId;
            clientId &&
              clients.set(clientId, {
                socket,
                clientId,
                lastActive: new Date(),
              });
            console.log(`Активных клиентов: ${clients.size}`);
            socket.send(JSON.stringify({ command: "pid", value: process.pid }));
          } else if (data.command === "heartbeat") {
            if (clientId) {
              clients.set(clientId, {
                ...clients.get(clientId)!,
                lastActive: new Date(),
              });
            }
          } else {
            socket.send(JSON.stringify({ error: "Неизвестная команда" }));
          }
        } catch (err) {
          console.error("Ошибка обработки сообщения:", err);
          socket.send(JSON.stringify({ error: "Неверный формат сообщения" }));
        }
      });

      socket.on("close", () => {
        if (clientId) {
          clients.delete(clientId);
          console.log(
            `Клиент ${clientId} отключён. Активных клиентов: ${clients.size}`
          );
        }
      });

      socket.on("error", (err) => {
        console.error("Ошибка WebSocket:", err);
        if (clientId) {
          clients.delete(clientId);
        }
      });
    }
  );

  try {
    await app.listen({
      port: port,
      host: HOST,
    });
    console.log(`{"PORT":${port},"PID":${process.pid}}`);
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use, trying next port...`);
      startServer(port! + 1);
    } else {
      console.error("Error starting server:", error);
      process.exit(1);
    }
  }
};

startServer(PORT);
