import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import {
  activeClients,
  updateActiveClient,
  addClient,
  removeClient,
  broadcast,
} from "./websocketStore";
interface AuthQuery {
  userId: string;
}

export function setupWebSocket(app: FastifyInstance) {
  app.get<{ Querystring: AuthQuery }>(
    "/ws",
    { websocket: true },
    (socket, req) => {
      let clientId: string | null = null;

      // 1. Получаем пользователя из query-параметров
      let userId = req.query.userId;

      if (!userId) {
        // Всегда проверяйте, что идентификатор пользователя передан
        console.error("Подключение без userId отклонено.");
        socket.send(JSON.stringify({ error: "Authentication required" }));
        socket.close();
        return;
      }
      // 2. **ДОБАВЛЕНИЕ КЛИЕНТА**
      // Присваиваем сокет ID сразу, как только он прошел идентификацию
      addClient(userId, socket);

      console.log("добавили пользователя", userId);

      socket.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());

          switch (data.command) {
            case "checkActiveUser":
              broadcast({
                command: "ping",
                timestamp: new Date().toISOString(),
              });
              break;
            case "stopProcess":
              broadcast({
                command: "shutdown",
                timestamp: new Date().toISOString(),
              });
              break;

            case "appClientConnect":
              clientId = data.user;
              socket.send(JSON.stringify({ command: "connected", clientId }));
              console.log(`Клиент ${clientId} подключён`);
              break;

            // case "convertDone":
            //   if (clientId) {
            //     socket.send(
            //       JSON.stringify({ command: "convertDone", clientId })
            //     );
            //     console.log(`convertDone от ${clientId}`);
            //   }
            //   break;

            case "pong":
              console.log(data);

              updateActiveClient(data.userId);
              break;

            default:
              socket.send(JSON.stringify({ error: "Неизвестная команда" }));
          }
        } catch (err) {
          console.error("WS message error:", err);
          socket.send(JSON.stringify({ error: "Неверный формат сообщения" }));
        }
      });

      socket.on("close", () => {
        removeClient(userId);
        // activeClients.delete(userId); // 🗑️ Удаляем сокет из Map
        console.log(`WebSocket закрыт для клиента: ${userId}`);
      });

      socket.on("error", (err) => {
        console.error("WebSocket error:", err);
      });
    }
  );
}
