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
import defectHistoryRoutes from "./routes/defectHistory";
import { config } from "dotenv";
import { registerClient, createLogger } from "./logger";

config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "localhost";
const API_KEY = "your-secret-api-key-12345";
const logger = createLogger();

const options: AppOptions = {
  logger,
  data_model: process.env.DATA_MODEL || "default_model",
  log_level: process.env.LOG_LEVEL || "info",
  enableTracing: process.env.ENABLE_TRACING === "true" || false,
};

const clients = new Map<
  string,
  { socket: any; clientId: string; lastActive: Date; pid: string }
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
defectHistoryRoutes(app);

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

  // внутри startServer или после app построен
  app.get("/clients", async (request, reply) => {
    const clientList = Array.from(clients.entries()).map(([id, client]) => ({
      clientId: id,
      lastActive: client.lastActive,
      pid: client.pid,
    }));

    reply.send({ count: clients.size, clients: clientList, tt: clients });
  });

  app.get(
    "/ws",
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
      registerClient(socket);

      let clientId: string | null = null;

      //ЧИТАЕМ СООБЩЕНЬКИ

      socket.on("message", (message) => {
        try {
          const messageStr = message.toString();
          // Проверяем, является ли сообщение JSON
          let data;
          data = JSON.parse(messageStr);

          console.log("Получено сообщение:", data);

          if (data.command === "appClientConnect") {
            clientId = data.user;
            clientId &&
              clients.set(clientId, {
                socket,
                clientId,
                lastActive: new Date(),
                pid: data.pid,
              });
            console.log(`Активных клиентов: ${clients.size}`);
            // socket.send(JSON.stringify({ command: "pid", value: process.pid }));
          } else if (data.command === "appClientDisconnect") {
            if (data.user) {
              clients.delete(data.user);
              console.log(
                `Клиент ${data.user} отключён. Активных клиентов: ${clients.size}`
              );
            }
          } else if (data.command === "heartbeat") {
            if (data.user) {
              clients.set(data.user, {
                ...clients.get(data.user)!,
                lastActive: data.timestamp,
              });
            }
          } else if (data.command === "convertDone") {
            if (clientId) {
              socket.send(JSON.stringify({ command: "convertDone", clientId }));
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
