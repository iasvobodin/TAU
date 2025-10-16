// src/server.ts
import { buildApp } from "./app";
import type { AppOptions } from "./app";
import { config } from "dotenv";
import { registerRoutes } from "./routes";
import { setupWebSocket } from "./websocket/manager";
import { authMiddleware } from "./middleware/auth";
import { findAvailablePort } from "./utils/portFinder";

config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "localhost";
const MAX_PORT_ATTEMPTS = 10;

const options: AppOptions = {
  data_model: process.env.DATA_MODEL || "default_model",
  log_level: process.env.LOG_LEVEL || "info",
  enableTracing: process.env.ENABLE_TRACING === "true",
};

async function startServer() {
  try {
    const app = await buildApp(options);

    // Применяем middleware для аутентификации
    authMiddleware(app);

    // Регистрируем все HTTP роуты
    registerRoutes(app);

    // Настраиваем WebSocket
    setupWebSocket(app);

    // Находим свободный порт
    const availablePort = await findAvailablePort(PORT, MAX_PORT_ATTEMPTS);

    // Запускаем сервер
    await app.listen({
      port: availablePort,
      host: HOST,
    });

    console.log(
      JSON.stringify({
        PORT: availablePort,
        PID: process.pid,
        ENV: process.env.NODE_ENV || "development",
      })
    );
  } catch (error) {
    console.error("Fatal error starting server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

startServer();
