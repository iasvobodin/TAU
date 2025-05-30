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

// src/server.ts
import { config } from "dotenv";

// Явно загружаем нужный .env
config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST;

const options: AppOptions = {
  logger: true,
  data_model: process.env.DATA_MODEL || "default_model",
  log_level: process.env.LOG_LEVEL || "info",
  enableTracing: process.env.ENABLE_TRACING === "true" || false,
};

// const app = await buildApp(options);

const API_KEY = "your-secret-api-key-12345"; // Уникальный ключ для приложения

const app = await buildApp(options);

// Middleware для проверки API-ключа для HTTP-запросов
app.addHook("preHandler", (request, reply, done) => {
  // Публичные маршруты, которые не требуют API-ключа
  const publicRoutes = ["/pid", "/ws"];
  if (publicRoutes.includes(request.url)) {
    done(); // Пропускаем проверку
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

const startServer = async (port: number | undefined) => {
  // получение PID для корректного заверщения работы сервера из приложения
  app.get("/pid", async (request, reply) => {
    try {
      const pid = process.pid;
      reply.send({ pid });
    } catch (error) {
      reply.code(500).send({ error: "Error fetching PID" });
    }
  });

  // WebSocket маршрут
  app.get(
    "/ws",
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
      socket.on("message", (message) => {
        console.log("Получено сообщение:", message);
        // message.toString() === 'hi from client'
        const pid = process.pid;
        socket.send(`PID:${pid}`);
      });
      socket.on("close", () => {
        console.log("WebSocket соединение закрыто");
      });
    }
  );

  try {
    await app.listen({
      port: port,
      host: HOST,
    });
    // await Bun.write(Bun.stdout, `{"PORT":${port},"PID":${process.pid}}`);
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
