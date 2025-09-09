import type { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export default async function imageRoutes(app: FastifyInstance) {
  app.post("/upload-image", async (request, reply) => {
    try {
      const data = await request.file(); // Получаем один файл
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      // Генерируем уникальное имя файла
      const ext = path.extname(data.filename);
      const fileName = uuidv4() + ext;

      // Папка для хранения изображений
      const uploadDir = new URL("./uploads", import.meta.url).pathname;
      const filePath = path.join(uploadDir, fileName);

      // Сохраняем файл корректно с типизацией TypeScript
      const buffer = await data.toBuffer(); // Buffer
      await fs.writeFile(filePath, new Uint8Array(buffer)); // Uint8Array — совместимо с TypeScript

      // Возвращаем URL для фронта
      const url = `/uploads/${fileName}`; // при необходимости можно заменить на полный URL
      reply.send({ url });
    } catch (err) {
      console.error(err);
      reply.code(500).send({ error: "Upload failed" });
    }
  });
}
