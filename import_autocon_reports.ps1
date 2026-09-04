<#
.SYNOPSIS
    Импорт AutoCon-отчётов из сетевой папки в БД.
.DESCRIPTION
    1. Получает продукты из API, строит карту: digitSequence -> snProduct
    2. Получает все ProductionOperations, строит карту: productId -> operation
    3. Читает match_report.md, для каждого сопоставленного файла:
       - Читает содержимое HTML/MHT
       - Находит ProductionOperation по productId
       - Добавляет отчёт в JSON-массив autoconReport через PUT
#>

param(
    [string]$ApiUrl = "http://10.69.19.59:3000",
    [string]$ApiKey = "your-secret-api-key-12345",
    [string]$ReportsPath = "\\rucekaspinffs05.metran.local\Dept-MP\Production\Internal\Продукты\ТАУ\Результаты",
    [string]$MatchReportFile = "match_report.md"
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8

$headers = @{
    "x-api-key" = $ApiKey
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# ============================================================
# ШАГ 1. Строим карту: digitSequence -> snProduct
# ============================================================
Write-Host ">>> Получение продуктов из API..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/products" -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
    $allProducts = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Продуктов: $($allProducts.Count)" -ForegroundColor Green
} catch {
    Write-Error "Не удалось получить продукты: $_"
    exit 1
}

$productMap = @{}
foreach ($p in $allProducts) {
    if ($p.snProduct) { $productMap[$p.snProduct] = $p }
}

# Карта: digitSequence -> snProduct
$digitToSnProduct = @{}

# 1. Из snProduct: "TAU19261001146" -> цифры "19261001146"
foreach ($p in $allProducts) {
    if ($p.snProduct) {
        $digits = $p.snProduct -replace '[^0-9]', ''
        if ($digits.Length -ge 5) {
            $digitToSnProduct[$digits] = $p.snProduct
        }
    }
}

# 2. Из компонентов (board serials)
$processedCount = 0
$total = $allProducts.Count
foreach ($p in $allProducts) {
    $processedCount++
    if ($processedCount % 100 -eq 0) {
        Write-Host "[INFO] Обработано $processedCount из $total продуктов..." -ForegroundColor White
    }
    
    if (-not $p.specification -or -not $p.specification.electronicBoard2) { continue }
    
    try {
        $detailResponse = Invoke-WebRequest -Uri "$ApiUrl/products/$($p.snProduct)" -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
        $productDetail = $detailResponse.Content | ConvertFrom-Json
    } catch { continue }
    
    $components = $productDetail.components
    if (-not $components) { continue }
    
    $foundComp = $components | Where-Object { $_.pnComponentId -eq $p.specification.electronicBoard2 } | Select-Object -First 1
    if (-not $foundComp -or -not $foundComp.snComponent) { continue }
    
    if ($foundComp.snComponent -match '^(\d+)') {
        $boardSerial = $matches[1]
        $digitToSnProduct[$boardSerial] = $p.snProduct
    }
    
    Start-Sleep -Milliseconds 20
}

Write-Host "[OK] Карта digit->snProduct: $($digitToSnProduct.Count) записей" -ForegroundColor Green

# Smart Search (serialSearch.ts algorithm)
function Invoke-SmartSearch {
    param([string]$Query, [hashtable]$Map)
    if ($Query.Length -lt 5) { return $null }
    $year = $Query.Substring(0, 2)
    $week = $Query.Substring(2, 2)
    $orderNumber = $Query.Substring(4)
    $types = @(1, 2, 3, 4, 5, 6, 7)
    foreach ($type in $types) {
        $genSerial = "TAU$week$year$type$($orderNumber.PadLeft(6, '0'))"
        if ($Map.ContainsKey($genSerial)) { return $genSerial }
    }
    return $null
}

# ============================================================
# ШАГ 1b. Получаем все ProductionOperations и строим карту productId -> operation
# ============================================================
Write-Host "`n>>> Получение ProductionOperations..." -ForegroundColor Cyan

try {
    $opsResponse = Invoke-WebRequest -Uri "$ApiUrl/production-operations" -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
    $allOperations = $opsResponse.Content | ConvertFrom-Json
    Write-Host "[OK] Операций: $($allOperations.Count)" -ForegroundColor Green
} catch {
    Write-Error "Не удалось получить операции: $_"
    exit 1
}

# Строим карту: productId -> первая подходящая операция (functionalTest > marking > assembly)
$opsByProductId = @{}
foreach ($op in $allOperations) {
    if (-not $op.productId) { continue }
    if ($opsByProductId.ContainsKey($op.productId)) { continue }  # берём первую
    $opsByProductId[$op.productId] = $op
}

Write-Host "[OK] Операций с productId: $($opsByProductId.Count)" -ForegroundColor Green

# ============================================================
# ШАГ 2. Читаем match_report.md и собираем файлы
# ============================================================
Write-Host "`n>>> Чтение match_report.md..." -ForegroundColor Cyan

$reportLines = Get-Content -Path $MatchReportFile -Encoding utf8
$foundLines = $reportLines | Where-Object {
    $_ -match '^\|\s*\d+\s\|' -and ($_ -match 'METHOD1_FOUND' -or $_ -match 'METHOD2_FOUND')
}
Write-Host "[INFO] Строк с совпадениями: $($foundLines.Count)" -ForegroundColor White

$productFiles = @{}
$totalEntries = 0

foreach ($line in $foundLines) {
    $parts = $line -split '\|' | ForEach-Object { $_.Trim() }
    if ($parts.Count -lt 5) { continue }
    
    $relativePath = $parts[2]
    $digitSeq = $parts[3]
    $fullPath = Join-Path -Path $ReportsPath -ChildPath $relativePath
    
    # Находим snProduct
    $snProduct = $null
    
    if ($digitToSnProduct.ContainsKey($digitSeq)) {
        $snProduct = $digitToSnProduct[$digitSeq]
    }
    
    if (-not $snProduct -and $digitSeq.Length -ge 8) {
        $first8 = $digitSeq.Substring(0, 8)
        if ($digitToSnProduct.ContainsKey($first8)) {
            $snProduct = $digitToSnProduct[$first8]
        }
    }
    
    if (-not $snProduct) {
        $snProduct = Invoke-SmartSearch -Query $digitSeq -Map $productMap
    }
    
    if (-not $snProduct) {
        Write-Host "     [WARN] Не удалось определить snProduct для: $relativePath" -ForegroundColor Yellow
        continue
    }
    
    if (-not $productFiles.ContainsKey($snProduct)) {
        $productFiles[$snProduct] = @()
    }
    $productFiles[$snProduct] += [PSCustomObject]@{
        RelativePath = $relativePath
        FullPath     = $fullPath
        DigitSeq     = $digitSeq
    }
    $totalEntries++
}

Write-Host "[INFO] Уникальных продуктов: $($productFiles.Keys.Count)" -ForegroundColor White
Write-Host "[INFO] Всего файлов для импорта: $totalEntries" -ForegroundColor White

# ============================================================
# ШАГ 3. Импортируем
# ============================================================
$processedCount = 0
$successCount = 0
$skipCount = 0
$errorCount = 0

foreach ($snProduct in $productFiles.Keys) {
    $files = $productFiles[$snProduct]
    $processedCount++
    
    Write-Host "`n[$processedCount/$($productFiles.Keys.Count)] $snProduct (файлов: $($files.Count))" -ForegroundColor Cyan
    
    # Ищем по productId (не productSN!)
    if (-not $opsByProductId.ContainsKey($snProduct)) {
        Write-Host "     [SKIP] Нет операций для $snProduct" -ForegroundColor Yellow
        $skipCount++
        continue
    }
    
    $operation = $opsByProductId[$snProduct]
    $operationId = $operation.id
    Write-Host "     Операция ID: $operationId, тип: $($operation.stageType)" -ForegroundColor White
    
    # Читаем текущий autoconReport
    $currentReports = @()
    if ($operation.autoconReport) {
        try {
            $currentReports = $operation.autoconReport | ConvertFrom-Json
            if (-not $currentReports -or $currentReports.GetType().Name -ne 'Object[]') {
                $currentReports = @($currentReports)
            }
        } catch { $currentReports = @() }
    }
    
    $existingCount = $currentReports.Count
    $newCount = 0
    
    foreach ($file in $files) {
        if (-not (Test-Path $file.FullPath)) {
            Write-Host "     [WARN] Файл не найден: $($file.FullPath)" -ForegroundColor Yellow
            continue
        }
        
        $ext = [System.IO.Path]::GetExtension($file.FullPath).ToLower()
        $fileType = switch ($ext) {
            '.htm' { 'html' }; '.html' { 'html' }; '.mht' { 'html' }
            '.png' { 'image' }; '.jpg' { 'image' }; '.jpeg' { 'image' }
            default { 'other' }
        }
        
        $content = $null
        if ($fileType -eq 'html') {
            try {
                $content = Get-Content -Path $file.FullPath -Raw -Encoding UTF8 -ErrorAction Stop
            } catch {
                try { $content = Get-Content -Path $file.FullPath -Raw -Encoding Default -ErrorAction Stop }
                catch { Write-Host "     [WARN] Не удалось прочитать: $($file.RelativePath)" -ForegroundColor Yellow; continue }
            }
        }
        
        # Проверяем дубликаты
        $dup = $false
        foreach ($ex in $currentReports) { if ($ex.filePath -eq $file.RelativePath) { $dup = $true; break } }
        if ($dup) { Write-Host "     [SKIP] Уже импортирован: $($file.RelativePath)" -ForegroundColor Gray; continue }
        
        $entry = [PSCustomObject]@{
            fileName   = [System.IO.Path]::GetFileName($file.FullPath)
            filePath   = $file.RelativePath
            content    = $content
            type       = $fileType
            importedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        }
        $currentReports += $entry
        $newCount++
        Write-Host "     [ADD] $($file.RelativePath) ($fileType)" -ForegroundColor Green
    }
    
    if ($newCount -eq 0) {
        Write-Host "     [OK] Нет новых файлов (было $existingCount)" -ForegroundColor Gray
        $successCount++
        continue
    }
    
    # PUT-запрос
    $reportJson = $currentReports | ConvertTo-Json -Depth 10
    $body = @{ autoconReport = $reportJson } | ConvertTo-Json
    
    try {
        Invoke-WebRequest -Uri "$ApiUrl/production-operations/$operationId" `
            -Method PUT -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop | Out-Null
        Write-Host "     [OK] +$newCount новых (всего: $($currentReports.Count))" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "     [ERROR] PUT: $_" -ForegroundColor Red
        $errorCount++
    }
    
    Start-Sleep -Milliseconds 50
}

# Итог
Write-Host "`n==========================================" -ForegroundColor Magenta
Write-Host "          ИТОГ ИМПОРТА" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Всего файлов для импорта: $totalEntries" -ForegroundColor Cyan
Write-Host "Уникальных продуктов: $($productFiles.Keys.Count)" -ForegroundColor Cyan
Write-Host "Успешно: $successCount" -ForegroundColor Green
Write-Host "Пропущено (нет операции): $skipCount" -ForegroundColor Yellow
Write-Host "Ошибок: $errorCount" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Magenta
