import pino from "pino";
import { multistream } from "pino-multi-stream";

// Кэш клиентов внутри модуля
const websocketClients = new Set<any>();

export function registerClient(ws: any) {
  websocketClients.add(ws);
  ws.on("close", () => websocketClients.delete(ws));
  ws.on("error", () => websocketClients.delete(ws));
}

export function createLogger() {
  const logsToWebSocketStream = {
    write(msg: string) {
      websocketClients.forEach((client) => {
        if (client.readyState === 1) {
          // Отправляем как строку — лог уже строка от pino
          client.send(
            JSON.stringify({
              type: "server_log",
              log: msg, // строка!
            })
          );
        }
      });
    },
  };

  return pino(
    { level: process.env.LOG_LEVEL || "info" },
    multistream([{ stream: process.stdout }, { stream: logsToWebSocketStream }])
  );
}
