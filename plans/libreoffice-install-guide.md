# Инструкция по установке LibreOffice для серверной конвертации паспортов

## Зачем это нужно

Серверный endpoint `POST /api/passport/convert` использует LibreOffice (`soffice --headless --convert-to pdf`) для конвертации docx → pdf. Это альтернатива текущему локальному конвейеру через MS Word + ps1.

## Шаг 1: Установка LibreOffice

### Если сервер на Windows

**Вариант A — через установщик:**

1. Скачать [LibreOffice Fresh](https://www.libreoffice.org/download/) (последняя стабильная версия)
2. Запустить установщик
3. Выбрать тип установки **«Выборочная»** → отметить только компонент **Writer**
4. Завершить установку

**Вариант B — через winget (если установлен):**

```powershell
winget install TheDocumentFoundation.LibreOffice
```

**Вариант C — тихая установка (для автоматизации):**

```powershell
# Скачать установщик
Invoke-WebRequest -Uri "https://download.documentfoundation.org/libreoffice/stable/25.2.2/win/x86_64/LibreOffice_25.2.2_Win_x86-64.msi" -OutFile "$env:TEMP\LibreOffice.msi"

# Тихая установка (только Writer)
msiexec /i "$env:TEMP\LibreOffice.msi" ADDLOCAL=Writer /qn
```

### Если сервер на Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libreoffice-writer -y

# CentOS/RHEL/Fedora
sudo yum install libreoffice-writer -y

# Alpine
apk add libreoffice-writer
```

## Шаг 2: Проверка установки

В терминале (от имени того же пользователя, под которым запущен сервер Bun):

```powershell
soffice --version
```

Ожидаемый вывод:

```
LibreOffice 25.2.2.2 30(Build:2)
```

## Шаг 3: Проверка через API

```powershell
curl http://localhost:3001/api/passport/check-soffice
```

Ожидаемый ответ:

```json
{ "available": true, "version": "LibreOffice 25.2.2.2 30(Build:2)" }
```

## Шаг 4: Тестовая конвертация

В интерфейсе сборки продукта нажать кнопку **«Печать отгрузочного паспорта (сервер)»**.

Альтернативно — через curl:

```powershell
curl -X POST http://localhost:3001/api/passport/convert `
  -H "Content-Type: application/json" `
  -d '{\"partNumber\": \"ТЕСТ-АРТИКУЛ\", \"serialNumbers\": [\"ТЕСТ-SN-001\"]}'
```

## Возможные проблемы

### 1. Первый запуск soffice медленный (10-30 сек)

Нормально. LibreOffice создаёт пользовательский профиль при первом запуске. Последующие вызовы будут быстрее.

### 2. Ошибка доступа к сетевой папке

Процесс Bun должен иметь права на чтение `//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта`.

**Решение:** Если сервер запущен как служба или от System — настроить доступ к UNC-пути или смонтировать сетевую папку как локальный диск:

```powershell
net use Z: "\\rucekaspinffs05.metran.local\Dept-MP\Production\Internal\Продукты\ТАУ\Паспорта" /persistent:yes
```

### 3. LibreOffice не виден в PATH

Проверить, что путь к `soffice.exe` добавлен в `PATH`:

```powershell
# Где установлен soffice (обычно):
# C:\Program Files\LibreOffice\program\soffice.exe

# Добавить в PATH:
$env:Path += ";C:\Program Files\LibreOffice\program"
```

### 4. Конкуренция за временную директорию

Все вызовы `/api/passport/convert` используют `server/temp_passports/`. Для каждого запроса создаётся уникальный `jobId`. Старые файлы (>60 мин) автоматически удаляются.
