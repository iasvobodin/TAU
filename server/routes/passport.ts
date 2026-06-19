import type { FastifyInstance } from "fastify";
import { execSync, exec } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "fs";
import { join, resolve } from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { patchDocument, PatchType, TextRun } from "docx";

const execAsync = promisify(exec);

// Кеш для пути к soffice (чтобы не искать каждый раз)
let _sofficePath: string | null = null;

/**
 * Нормализовать UNC-путь для Windows: //server/share → \\server\share
 */
function normalizePath(path: string): string {
  return path.replace(/^\/\//, "\\\\").replace(/\//g, "\\");
}

// ─── Конфигурация (загружается из config.json) ──────────────────────────────

interface AppConfig {
  paths: {
    passports: string;
    convertFolder: string;
    resourcesPath: string;
  };
}

function findConfigPath(): string | null {
  // 1. Приоритет: переменная окружения CONFIG_PATH
  if (process.env.CONFIG_PATH) {
    const p = resolve(process.env.CONFIG_PATH);
    if (existsSync(p)) return p;
  }

  // 2. Относительно __dirname (работает в скомпилированном bundle)
  try {
    const dir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
    const candidates = [
      resolve(dir, "../config.json"), // shared/../config.json
      resolve(dir, "../../config.json"), // shared/server/../../config.json
      resolve(dir, "config.json"), // shared/config.json
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  } catch {
    // __dirname может быть недоступен в ESM
  }

  // 3. Относительно process.cwd()
  const cwdCandidates = [
    resolve(process.cwd(), "../config.json"),
    resolve(process.cwd(), "config.json"),
  ];
  for (const p of cwdCandidates) {
    if (existsSync(p)) return p;
  }

  return null;
}

function loadConfig(): AppConfig {
  const defaults: AppConfig = {
    paths: {
      passports:
        "//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта",
      convertFolder: "./convertFolder",
      resourcesPath: "/frontend/dist/",
    },
  };

  const configPath = findConfigPath();
  if (configPath) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.paths?.passports) {
        defaults.paths.passports = parsed.paths.passports;
      }
      console.log(
        "[passport] Загружен config.json из",
        configPath,
        "passports:",
        defaults.paths.passports,
      );
    } catch (err) {
      console.warn("[passport] Ошибка чтения config.json:", err);
    }
  } else {
    console.warn("[passport] config.json не найден, использую дефолтные пути");
  }

  return defaults;
}

const CONFIG = loadConfig();
const SEARCH_DIR = normalizePath(CONFIG.paths.passports);
const TEMP_DIR = resolve("./temp_passports");

console.log("[passport] SEARCH_DIR:", SEARCH_DIR);

// ─── Вспомогательные функции ────────────────────────────────────────────────

/**
 * Найти полный путь к soffice.exe.
 * Только через existsSync — без запуска процессов.
 */
function findSofficeBinary(): string | null {
  if (_sofficePath) return _sofficePath;

  const commonPaths = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "soffice", // если в PATH — existsSync не сработает, но проверим позже
    // Linux
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
  ];

  for (const p of commonPaths) {
    if (existsSync(p)) {
      _sofficePath = p;
      console.log("[passport] Найден soffice:", p);
      return _sofficePath;
    }
  }

  return null;
}

/**
 * Проверка доступности LibreOffice — только через existsSync,
 * без вызова процессов (чтобы избежать зависания).
 */
function checkSoffice(): {
  available: boolean;
  version?: string;
  error?: string;
} {
  const sofficePath = findSofficeBinary();
  if (sofficePath) {
    return {
      available: true,
      version: "обнаружен по пути: " + sofficePath,
    };
  }
  return {
    available: false,
    error:
      "LibreOffice не найден ни в одном из стандартных путей. Установите LibreOffice (https://www.libreoffice.org/download/).",
  };
}

/**
 * Поиск шаблона .docx в сетевой папке по partNumber
 */
function findTemplate(partNumber: string): string | null {
  try {
    const files = readdirSync(SEARCH_DIR);
    const found = files.find(
      (file) => file.includes(partNumber) && file.endsWith(".docx"),
    );
    if (found) {
      return join(SEARCH_DIR, found);
    }
    return null;
  } catch (err) {
    console.error("[passport] Ошибка поиска шаблона:", err);
    return null;
  }
}

/**
 * Получить текущую дату в формате MM.YYYY
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${month}.${year}`;
}

/**
 * Патчинг .docx через библиотеку docx (аналогично frontend/docxProcessor.ts)
 */
/**
 * Патчинг .docx из буфера (когда шаблон получен от клиента)
 */
async function patchDocxFromBuffer(
  templateBuffer: Buffer,
  serialNumber: string,
): Promise<Buffer> {
  const patches = {
    serialnumber: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun(serialNumber)],
    },
    currentdate: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun(getCurrentMonthYear())],
    },
    ProdName: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun("ООО «Метран Проект».")],
    },
    ProdAddress: {
      type: PatchType.PARAGRAPH,
      children: [
        new TextRun(
          "454103, Российская Федерация, Челябинская область, г. Челябинск,\n пр-кт. Новоградский, д. 15, стр.1, Тел. +7 (351) 240 88 82.",
        ),
      ],
    },
  };

  const patched = await patchDocument({
    outputType: "arraybuffer",
    data: templateBuffer.buffer,
    patches,
  });

  return Buffer.from(patched);
}

/**
 * Патчинг .docx через библиотеку docx (аналогично frontend/docxProcessor.ts)
 */
async function patchDocx(
  templatePath: string,
  serialNumber: string,
): Promise<Buffer> {
  const fileData = readFileSync(templatePath);

  const patches = {
    serialnumber: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun(serialNumber)],
    },
    currentdate: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun(getCurrentMonthYear())],
    },
    ProdName: {
      type: PatchType.PARAGRAPH,
      children: [new TextRun("ООО «Метран Проект».")],
    },
    ProdAddress: {
      type: PatchType.PARAGRAPH,
      children: [
        new TextRun(
          "454103, Российская Федерация, Челябинская область, г. Челябинск,\n пр-кт. Новоградский, д. 15, стр.1, Тел. +7 (351) 240 88 82.",
        ),
      ],
    },
  };

  const patched = await patchDocument({
    outputType: "arraybuffer",
    data: fileData.buffer,
    patches,
  });

  return Buffer.from(patched);
}

/**
 * Конвертация .docx → .pdf через LibreOffice headless
 */
async function convertDocxToPdf(docxPath: string): Promise<string> {
  const pdfPath = docxPath.replace(/\.docx$/i, ".pdf");

  let sofficePath = findSofficeBinary();
  if (!sofficePath) {
    // Если не нашли через existsSync — пробуем просто "soffice" (надеясь на PATH)
    sofficePath = "soffice";
  }

  // Pipe пустой строки, чтобы soffice не ждал Enter
  const cmd = `echo. | "${sofficePath}" --headless --convert-to pdf --outdir "${resolve(TEMP_DIR)}" "${docxPath}"`;

  const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
  console.log("[passport] soffice stdout:", stdout);
  if (stderr) console.warn("[passport] soffice stderr:", stderr);

  if (!existsSync(pdfPath)) {
    throw new Error(`PDF не создан после конвертации: ${pdfPath}`);
  }

  return pdfPath;
}

/**
 * Очистка временных файлов старше keepMinutes минут
 */
function cleanupTempFiles(dir: string, keepMinutes: number = 60): void {
  try {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir);
    const now = Date.now();
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stats = statSync(filePath);
        const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;
        if (ageMinutes > keepMinutes) {
          unlinkSync(filePath);
          console.log("[passport] Очищен временный файл:", filePath);
        }
      } catch {
        // Файл может быть удалён конкурентно — игнорируем
      }
    }
  } catch {
    // Директория может не существовать
  }
}

// ─── Роуты ──────────────────────────────────────────────────────────────────

export default function passportRoutes(app: FastifyInstance) {
  // ── Проверка доступности LibreOffice ──
  app.get("/api/passport/check-soffice", async (request, reply) => {
    const result = checkSoffice();
    return reply.send(result);
  });

  // ── Конвертация паспорта (основной endpoint) ──
  // Принимает partNumber + serialNumbers, и опционально templateBase64
  // Если templateBase64 передан — не ищет шаблон на сетевой папке
  app.post<{
    Body: {
      partNumber: string;
      serialNumbers: string[];
      templateBase64?: string;
    };
  }>("/api/passport/convert", async (request, reply) => {
    const { partNumber, serialNumbers, templateBase64 } = request.body;

    // ── Валидация ──
    if (!partNumber || !serialNumbers || serialNumbers.length === 0) {
      return reply.code(400).send({
        success: false,
        error: "partNumber и serialNumbers обязательны",
        code: "INVALID_PARAMS",
      });
    }

    // ── Проверка LibreOffice ──
    const sofficeCheck = checkSoffice();
    if (!sofficeCheck.available) {
      return reply.code(503).send({
        success: false,
        error: `LibreOffice не доступен: ${sofficeCheck.error}`,
        code: "SOFFICE_NOT_FOUND",
      });
    }

    // ── Получаем шаблон: или от клиента (Base64), или ищем на сетевой папке ──
    let templateBuffer: Buffer | null = null;

    if (templateBase64) {
      // Шаблон прислал клиент
      templateBuffer = Buffer.from(templateBase64, "base64");
      console.log(
        "[passport] Получен шаблон от клиента, размер:",
        templateBuffer.length,
      );
    } else {
      // Ищем на сетевой папке (старый способ)
      const templatePath = findTemplate(partNumber);
      if (!templatePath) {
        return reply.code(404).send({
          success: false,
          error: `Шаблон для артикула "${partNumber}" не найден`,
          code: "TEMPLATE_NOT_FOUND",
        });
      }
      console.log("[passport] Найден шаблон:", templatePath);
      templateBuffer = readFileSync(templatePath);
    }

    // ── Создаём временную директорию ──
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Очищаем старые временные файлы
    cleanupTempFiles(TEMP_DIR);

    const jobId = randomUUID().slice(0, 8);
    const pdfPaths: string[] = [];

    try {
      // ── Для каждого серийника: патчим и конвертируем ──
      for (const sn of serialNumbers) {
        const docxFileName = `${partNumber}__${sn}_${jobId}.docx`;
        const docxPath = join(TEMP_DIR, docxFileName);

        // Патчим шаблон (из буфера)
        const patchedDocx = await patchDocxFromBuffer(templateBuffer!, sn);
        writeFileSync(docxPath, patchedDocx);
        console.log(`[passport] Создан запатченный docx: ${docxPath}`);

        // Конвертируем в PDF
        const pdfPath = await convertDocxToPdf(docxPath);
        console.log(`[passport] Конвертирован в PDF: ${pdfPath}`);

        // Удаляем промежуточный docx
        try {
          unlinkSync(docxPath);
        } catch {
          // Не критично
        }

        pdfPaths.push(pdfPath);
      }

      // ── Если несколько PDF — пока возвращаем первый ──
      // TODO: склейка нескольких PDF через pdf-lib при batch-печати
      const firstPdfName = pdfPaths[0].split(/[/\\]/).pop()!;

      return reply.send({
        success: true,
        pdfUrl: `/api/passport/pdf/${firstPdfName}`,
        pdfName: firstPdfName,
        pagesCount: pdfPaths.length,
      });
    } catch (err: any) {
      console.error("[passport] Ошибка конвертации:", err);
      return reply.code(500).send({
        success: false,
        error: `Ошибка конвертации: ${err.message}`,
        code: "CONVERSION_FAILED",
      });
    }
  });

  // ── Раздача сгенерированных PDF ──
  app.get("/api/passport/pdf/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = join(TEMP_DIR, filename);

    if (!existsSync(filePath)) {
      return reply.code(404).send({
        success: false,
        error: `Файл "${filename}" не найден`,
        code: "FILE_NOT_FOUND",
      });
    }

    const fileBuffer = readFileSync(filePath);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${filename}"`);
    return reply.send(fileBuffer);
  });
}
