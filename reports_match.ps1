# Устанавливаем кодировку UTF-8 для корректного отображения русского текста
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

<#
.SYNOPSIS
    Скрипт сопоставления продуктов-модулей с отчётами из сетевой папки.
.DESCRIPTION
    Получает продукты через API, фильтрует модули, извлекает серийные номера
    электронных плат, сканирует сетевую папку с отчётами и формирует сводку.
#>

# Параметры
$script:ApiUrl = "http://10.69.19.59:3000"
$script:ApiKey = "your-secret-api-key-12345"
$script:ReportsPath = "\\rucekaspinffs05.metran.local\Dept-MP\Production\Internal\Продукты\ТАУ\Результаты"

# ============================================================
# Вспомогательные функции
# ============================================================

function Write-Step {
    param([string]$Message)
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# ============================================================
# Шаг 1. Получить все продукты через API
# ============================================================

Write-Step "ШАГ 1: Получение продуктов через API"

$headers = @{
    "x-api-key" = $script:ApiKey
    "Accept" = "application/json"
}

$products = @()

try {
    Write-Info "Запрос: GET $($script:ApiUrl)/products"
    $response = Invoke-WebRequest -Uri "$($script:ApiUrl)/products" `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop

    $products = $response.Content | ConvertFrom-Json
    Write-Success "Получено продуктов: $($products.Count)"
}
catch {
    Write-ErrorMsg "Не удалось получить продукты через API: $_"
    exit 1
}

# ============================================================
# Шаг 2. Отфильтровать продукты-модули
# ============================================================

Write-Step "ШАГ 2: Фильтрация продуктов-модулей (specification.type === 'Modules')"

$moduleProducts = @()
$withoutSpecCount = 0

foreach ($product in $products) {
    # Проверяем наличие specification
    if (-not $product.specification) {
        $withoutSpecCount++
        continue
    }

    # Проверяем тип
    $specType = $product.specification.type
    if ($specType -eq 'Modules') {
        $moduleProducts += $product
    }
}

Write-Success "Найдено продуктов-модулей: $($moduleProducts.Count)"
if ($withoutSpecCount -gt 0) {
    Write-Info "Продуктов без specification (пропущено): $withoutSpecCount"
}

# ============================================================
# Шаг 2 (продолжение). Извлечение серийных номеров плат
# ============================================================

Write-Step "ШАГ 2 (продолжение): Извлечение серийных номеров электронных плат"
Write-Info "Всего продуктов-модулей для обработки: $($moduleProducts.Count)"

$productsWithBoard = @()   # Продукты, у которых найден компонент "электронная плата 2"
$productsWithoutBoard = @() # Продукты без компонента
$processedCount = 0

foreach ($product in $moduleProducts) {
    $processedCount++
    $boardSerial = $null
    $boardSerialFull = $null

    # Выводим прогресс
    Write-Info "Обработано $processedCount из $($moduleProducts.Count) продуктов-модулей..."

    $electronicBoard2 = $product.specification.electronicBoard2

    if (-not $electronicBoard2) {
        Write-Info "Продукт '$($product.name)' (SN: $($product.serialNumber)): нет electronicBoard2 в specification"
        $productsWithoutBoard += [PSCustomObject]@{
            Product = $product
            Reason = "Нет electronicBoard2 в specification"
        }
        Start-Sleep -Milliseconds 100
        continue
    }

    # Делаем отдельный запрос для получения компонентов продукта
    try {
        $detailResponse = Invoke-WebRequest -Uri "$($script:ApiUrl)/products/$($product.snProduct)" `
            -Method GET `
            -Headers $headers `
            -UseBasicParsing `
            -ErrorAction Stop

        $productDetail = $detailResponse.Content | ConvertFrom-Json
    }
    catch {
        Write-ErrorMsg "Ошибка при запросе продукта '$($product.snProduct)': $_"
        $productsWithoutBoard += [PSCustomObject]@{
            Product = $product
            Reason = "Ошибка API: $_"
        }
        Start-Sleep -Milliseconds 100
        continue
    }

    # Ищем компонент с pnComponentId === electronicBoard2
    $components = $productDetail.components
    $foundComponent = $null

    if ($components -and ($components | Measure-Object).Count -gt 0) {
        $foundComponent = $components | Where-Object { $_.pnComponentId -eq $electronicBoard2 } | Select-Object -First 1
    }

    if (-not $foundComponent) {
        Write-Info "Продукт '$($product.name)' (SN: $($product.serialNumber)): компонент с pnComponentId='$electronicBoard2' не найден"
        $productsWithoutBoard += [PSCustomObject]@{
            Product = $product
            Reason = "Компонент с pnComponentId='$electronicBoard2' не найден"
        }
        Start-Sleep -Milliseconds 100
        continue
    }

    $snComponent = $foundComponent.snComponent

    if (-not $snComponent) {
        Write-Info "Продукт '$($product.name)' (SN: $($product.serialNumber)): у компонента нет snComponent"
        $productsWithoutBoard += [PSCustomObject]@{
            Product = $product
            Reason = "У компонента нет snComponent"
        }
        Start-Sleep -Milliseconds 100
        continue
    }

    # Извлекаем цифры до первого дефиса
    if ($snComponent -match '^(\d+)') {
        $boardSerial = $matches[1]
        $boardSerialFull = $snComponent

        $productsWithBoard += [PSCustomObject]@{
            Product = $product
            BoardSerialFull = $snComponent
            BoardSerial = $boardSerial
        }

        Write-Info "Продукт '$($product.serialNumber)': плата SN='$snComponent' -> номер='$boardSerial'"
    }
    else {
        Write-Info "Продукт '$($product.name)' (SN: $($product.serialNumber)): не удалось извлечь цифры из snComponent='$snComponent'"
        $productsWithoutBoard += [PSCustomObject]@{
            Product = $product
            Reason = "Не удалось извлечь цифры из snComponent='$snComponent'"
        }
    }

    # Небольшая задержка между запросами
    Start-Sleep -Milliseconds 100
}

Write-Success "Продуктов с компонентом 'электронная плата 2': $($productsWithBoard.Count)"
Write-Info "Продуктов без компонента 'электронная плата 2': $($productsWithoutBoard.Count)"

# ============================================================
# Шаг 3. Просканировать сетевую папку с отчётами
# ============================================================

Write-Step "ШАГ 3: Сканирование сетевой папки с отчётами"

$reportFiles = @()
$reportSerials = @()   # Массив хэшей: @{ File = ...; Serial = ... }

try {
    if (-not (Test-Path -Path $script:ReportsPath -PathType Container)) {
        throw "Сетевой путь недоступен: $script:ReportsPath"
    }

    Write-Info "Путь: $script:ReportsPath"
    $allFiles = Get-ChildItem -Path $script:ReportsPath -Recurse -File -ErrorAction Stop
    Write-Info "Всего файлов найдено: $($allFiles.Count)"

    $serialRegex = [regex]'(\d{8})(?!\d)'

    foreach ($file in $allFiles) {
        $fileNameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $match = $serialRegex.Match($fileNameWithoutExt)

        if ($match.Success) {
            $serial = $match.Groups[1].Value
            $reportSerials += [PSCustomObject]@{
                File = $file
                Serial = $serial
            }
        }
    }

    Write-Success "Найдено отчётов с серийными номерами: $($reportSerials.Count)"
}
catch {
    Write-ErrorMsg "Ошибка при сканировании сетевой папки: $_"
    exit 1
}

# Проверка на дубликаты серийных номеров в отчётах
$serialsFromReports = $reportSerials | Group-Object -Property Serial
$duplicates = $serialsFromReports | Where-Object { $_.Count -gt 1 }

if ($duplicates.Count -gt 0) {
    Write-Warn "Обнаружены дубликаты серийных номеров в отчётах:"
    foreach ($dup in $duplicates) {
        $filesList = ($reportSerials | Where-Object { $_.Serial -eq $dup.Name } | ForEach-Object { $_.File.FullName }) -join "`n    "
        Write-Warn "  Серийный номер '$($dup.Name)' найден в $($dup.Count) отчётах:"
        Write-Warn "    $filesList"
    }
}

# Уникальные серийные номера из отчётов
$uniqueReportSerials = $serialsFromReports | Select-Object -ExpandProperty Name
Write-Info "Уникальных серийных номеров из отчётов: $($uniqueReportSerials.Count)"

# ============================================================
# Шаг 4. Сопоставить и сформировать сводку
# ============================================================

Write-Step "ШАГ 4: Сопоставление продуктов и отчётов"

# Словарь: серийный номер платы -> список файлов отчётов
$reportSerialMap = @{}
foreach ($rs in $reportSerials) {
    if (-not $reportSerialMap.ContainsKey($rs.Serial)) {
        $reportSerialMap[$rs.Serial] = @()
    }
    $reportSerialMap[$rs.Serial] += $rs.File
}

# a. Найденные отчёты (сопоставились)
$matchedReports = @()

# b. Продукты без отчётов
$productsWithoutReports = @()

# c. Серийные номера отчётов без продуктов (вычислим после)

# Собираем все серийные номера плат
$allBoardSerials = $productsWithBoard | Select-Object -ExpandProperty BoardSerial
$boardSerialSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$allBoardSerials)

foreach ($pwB in $productsWithBoard) {
    $boardSerial = $pwB.BoardSerial

    if ($reportSerialMap.ContainsKey($boardSerial)) {
        # Найден отчёт
        foreach ($reportFile in $reportSerialMap[$boardSerial]) {
            $matchedReports += [PSCustomObject]@{
                ProductSerialNumber = $pwB.Product.serialNumber
                ProductName = $pwB.Product.specification.productName
                BoardSerialNumber = $boardSerial
                BoardSerialFull = $pwB.BoardSerialFull
                ReportFilePath = $reportFile.FullName
            }
        }
    }
    else {
        # Отчёт не найден
        $productsWithoutReports += [PSCustomObject]@{
            ProductSerialNumber = $pwB.Product.serialNumber
            ProductName = $pwB.Product.specification.productName
            BoardSerialNumber = $boardSerial
            BoardSerialFull = $pwB.BoardSerialFull
        }
    }
}

# c. Отчёты без продуктов
$reportsWithoutProducts = @()
foreach ($rs in $reportSerials) {
    if (-not $boardSerialSet.Contains($rs.Serial)) {
        $reportsWithoutProducts += [PSCustomObject]@{
            ReportFilePath = $rs.File.FullName
            SerialNumber = $rs.Serial
        }
    }
}

# ============================================================
# Вывод результатов
# ============================================================

Write-Host "`n" -NoNewline
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "          РЕЗУЛЬТАТЫ СОПОСТАВЛЕНИЯ          " -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta

# --- a. Найденные отчёты ---
Write-Host "`n--- a. НАЙДЕННЫЕ ОТЧЁТЫ (сопоставлены с продуктами) ---" -ForegroundColor Green
if ($matchedReports.Count -eq 0) {
    Write-Host "  (нет совпадений)" -ForegroundColor Gray
}
else {
    # Группируем по продукту
    $matchedGroups = $matchedReports | Group-Object -Property ProductSerialNumber
    foreach ($group in $matchedGroups) {
        $first = $group.Group[0]
        Write-Host "  Продукт SN: $($first.ProductSerialNumber)" -ForegroundColor White
        Write-Host "  Название: $($first.ProductName)" -ForegroundColor White
        Write-Host "  Серийный номер платы: $($first.BoardSerialNumber) (полный: $($first.BoardSerialFull))" -ForegroundColor White
        Write-Host "  Отчёты ($($group.Count)):" -ForegroundColor White
        foreach ($item in $group.Group) {
            Write-Host "    - $($item.ReportFilePath)" -ForegroundColor Gray
        }
        Write-Host ""
    }
}

# --- b. Продукты без отчётов ---
Write-Host "--- b. ПРОДУКТЫ БЕЗ ОТЧЁТОВ ---" -ForegroundColor Yellow
if ($productsWithoutReports.Count -eq 0) {
    Write-Host "  (нет)" -ForegroundColor Gray
}
else {
    foreach ($item in $productsWithoutReports) {
        Write-Host "  SN: $($item.ProductSerialNumber) | Название: $($item.ProductName) | Плата: $($item.BoardSerialNumber) ($($item.BoardSerialFull))" -ForegroundColor Yellow
    }
}

# --- c. Отчёты без продуктов ---
Write-Host "`n--- c. ОТЧЁТЫ БЕЗ ПРОДУКТОВ ---" -ForegroundColor Yellow
if ($reportsWithoutProducts.Count -eq 0) {
    Write-Host "  (нет)" -ForegroundColor Gray
}
else {
    foreach ($item in $reportsWithoutProducts) {
        Write-Host "  SN: $($item.SerialNumber) | Файл: $($item.ReportFilePath)" -ForegroundColor Yellow
    }
}

# ============================================================
# Шаг 5. Итоговая статистика
# ============================================================

Write-Host "`n" -NoNewline
Write-Host "========== СВОДКА ==========" -ForegroundColor Magenta
Write-Host "Всего продуктов-модулей: $($moduleProducts.Count)" -ForegroundColor Cyan
Write-Host "  - С компонентом 'электронная плата 2': $($productsWithBoard.Count)" -ForegroundColor Cyan
Write-Host "  - Без компонента 'электронная плата 2': $($productsWithoutBoard.Count)" -ForegroundColor Cyan
Write-Host "Найдено отчётов в сетевой папке: $($uniqueReportSerials.Count)" -ForegroundColor Cyan
Write-Host "Сопоставлено (отчёт + продукт): $($matchedReports.Count)" -ForegroundColor Cyan
Write-Host "Продуктов без отчётов: $($productsWithoutReports.Count)" -ForegroundColor Cyan
Write-Host "Отчётов без продуктов: $($reportsWithoutProducts.Count)" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Magenta

# ============================================================
# Завершение
# ============================================================

Write-Success "Скрипт завершён."
