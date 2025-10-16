import type WebSocket from "ws";

// 1. Хранилище Map
// Мы экспортируем его как константу.
interface ActiveClientData {
  ws: WebSocket; // Сам объект WebSocket
  lastActive: number; // Временная метка последней активности (Date.now())
  // userId?: string;   // Опционально: ID авторизованного пользователя
}

export const activeClients = new Map<string, ActiveClientData>();

// 2. Вспомогательные функции (опционально, но полезно для инкапсуляции логики)

export function addClient(userId: string, socket: WebSocket): void {
  activeClients.set(userId, {
    ws: socket,
    lastActive: Date.now(), // Устанавливаем при подключении
  });

  // Проверка на дублирование или открытое состояние может быть здесь
  // activeClients.set(userId, socket);
  console.log(
    `[STORE] Клиент ${userId} добавлен. Активных: ${activeClients.size}`
  );
}
export function updateActiveClient(userId: string): boolean {
  const clientData = activeClients.get(userId);

  if (clientData) {
    // 1. Обновляем метку последней активности
    clientData.lastActive = Date.now();

    // 2. Логирование (опционально)
    console.log(`[STORE] Активность клиента ${userId} обновлена.`);

    // Возвращаем true, если клиент найден и обновлен
    return true;
  } else {
    // Возвращаем false, если клиент не найден (например, был отключен)
    console.warn(
      `[STORE] Попытка обновить активность для неизвестного клиента: ${userId}`
    );
    return false;
  }
}

export function sendToClient(userId: string, message: object): void {
  const clientSocket = activeClients.get(userId);

  if (!clientSocket) {
    console.warn(`[STORE] Клиент ${userId} не найден.`);
    return;
  }

  if (clientSocket.ws.readyState === 1) {
    // 1 = OPEN
    try {
      clientSocket.ws.send(JSON.stringify(message));
      console.log(`[STORE] Сообщение отправлено клиенту ${userId}:`, message);
    } catch (err) {
      console.error(`[STORE] Ошибка отправки клиенту ${userId}:`, err);
    }
  } else {
    console.warn(
      `[STORE] Клиент ${userId} не в состоянии OPEN, текущее состояние: ${clientSocket.ws.readyState}`
    );
  }
}

export function removeClient(userId: string): void {
  activeClients.delete(userId);
  console.log(
    `[STORE] Клиент ${userId} удален. Активных: ${activeClients.size}`
  );
}

export function broadcast(message: object): void {
  const messageStr = JSON.stringify(message);

  activeClients.forEach((clientSocket, userId) => {
    // Проверка состояния перед отправкой
    if (clientSocket.ws.readyState === 1) {
      try {
        clientSocket.ws.send(messageStr);
        console.log(`Отправлено ${messageStr} ${activeClients.size} клиентам.`);
      } catch (error) {
        console.error(`Ошибка отправки клиенту ${userId}:`, error);
        // Можно рассмотреть удаление сокета, если ошибка критическая (например, сокет закрыт)
      }
    }
  });
}
