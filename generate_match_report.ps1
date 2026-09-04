<#
.SYNOPSIS
    Generates a match report between report files and database products.
    Uses two search methods:
      1. Direct: board serial number (first 8 digits) -> product board serial map
      2. Smart Search (serialSearch.ts algorithm): all consecutive digits from filename -> construct TAU serials for all 7 types
#>
param(
    [string]$ApiUrl = "http://10.69.19.59:3000",
    [string]$ApiKey = "your-secret-api-key-12345",
    [string]$ReportsPath = "\\rucekaspinffs05.metran.local\Dept-MP\Production\Internal\Продукты\ТАУ\Результаты",
    [string]$OutputFile = "match_report.md"
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8

Write-Host ">>> Getting products from API..." -ForegroundColor Cyan
$headers = @{
    "x-api-key" = $ApiKey
    "Accept" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/products" -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
    $allProducts = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Products: $($allProducts.Count)" -ForegroundColor Green
} catch {
    Write-Error "Failed to get products: $_"
    exit 1
}

# Include Modules (type=3), Controller (type=1), PAZ (type=4)
$targetProducts = @{
    'Controller' = $true
    'Modules'    = $true
    'PAZ'        = $true
}
$filteredProducts = $allProducts | Where-Object { $_.specification -and $targetProducts.ContainsKey($_.specification.type) }
Write-Host "[OK] Filtered products (Controller+Modules+PAZ): $($filteredProducts.Count)" -ForegroundColor Green

# Check distribution by type
$typeCounts = $filteredProducts | Group-Object { $_.specification.type } | Select-Object Name, Count
foreach ($tc in $typeCounts) {
    Write-Host "     - $($tc.Name): $($tc.Count)" -ForegroundColor White
}

# Build board serial -> product map (Method 1)
$boardSerialMap = @{}
# Build product serial -> product map for quick lookup (Method 2)
$productSerialMap = @{}
$processedCount = 0
$totalProducts = $filteredProducts.Count

foreach ($product in $filteredProducts) {
    $processedCount++
    if ($processedCount % 50 -eq 0) {
        Write-Host "[INFO] Processed $processedCount of $totalProducts..." -ForegroundColor White
    }

    # Store product by its TAU serial number (snProduct)
    if ($product.snProduct) {
        $productSerialMap[$product.snProduct] = $product
    }

    # Build board serial map for ALL product types (Controller, Modules, PAZ)
    $electronicBoard2 = $product.specification.electronicBoard2
    if (-not $electronicBoard2) { continue }

    try {
        $detailResponse = Invoke-WebRequest -Uri "$ApiUrl/products/$($product.snProduct)" -Method GET -Headers $headers -UseBasicParsing -ErrorAction Stop
        $productDetail = $detailResponse.Content | ConvertFrom-Json
    } catch {
        continue
    }

    $components = $productDetail.components
    if (-not $components -or ($components | Measure-Object).Count -eq 0) { continue }

    $foundComponent = $components | Where-Object { $_.pnComponentId -eq $electronicBoard2 } | Select-Object -First 1
    if (-not $foundComponent -or -not $foundComponent.snComponent) { continue }

    $snComponent = $foundComponent.snComponent
    if ($snComponent -match '^(\d+)') {
        $boardSerial = $matches[1]
        $boardSerialMap[$boardSerial] = @{
            SerialNumber     = $product.serialNumber
            ProductName      = $product.specification.productName
            BoardSerialFull  = $snComponent
            BoardSerial      = $boardSerial
            SnProduct        = $product.snProduct
        }
    }

    Start-Sleep -Milliseconds 30
}

Write-Host "[OK] Board serials collected: $($boardSerialMap.Count)" -ForegroundColor Green
Write-Host "[OK] Product serials collected: $($productSerialMap.Count)" -ForegroundColor Green

# ============================================================
# Smart Search implementation (based on serialSearch.ts)
# Takes a full digit sequence from a filename and tries to
# construct TAU serials: TAU + week + year + type + orderNumber.padStart(6,'0')
# ============================================================
function Invoke-SmartSearch {
    param(
        [string]$SearchQuery,       # Full consecutive digits from filename
        [string]$Prefix = "TAU",
        [hashtable]$ProductSerialMap
    )

    # Need at least 5 chars to extract year(2)+week(2)+rest(1)
    if ($SearchQuery.Length -lt 5) { return $null }

    $year = $SearchQuery.Substring(0, 2)         # e.g., "26"
    $week = $SearchQuery.Substring(2, 2)          # e.g., "21"
    $orderNumber = $SearchQuery.Substring(4)      # e.g., "00367"

    # Try all 7 module types (same order as serialSearch.ts)
    $types = @(1, 2, 3, 4, 5, 6, 7)

    foreach ($type in $types) {
        $numericPart = "$week$year$type$($orderNumber.PadLeft(6, '0'))"
        $generatedSerial = "$Prefix$numericPart"

        if ($ProductSerialMap.ContainsKey($generatedSerial)) {
            $product = $ProductSerialMap[$generatedSerial]
            return @{
                SerialNumber    = $product.serialNumber
                ProductName     = $product.specification.productName
                GeneratedSerial = $generatedSerial
                TypeId          = $type
                SnProduct       = $product.snProduct
            }
        }
    }

    return $null
}

# ============================================================
# Scan network folder
# ============================================================
Write-Host "`n>>> Scanning network folder..." -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path $ReportsPath -Recurse -File -ErrorAction Stop
Write-Host "[INFO] Total files: $($allFiles.Count)" -ForegroundColor White

# Regex to find the LONGEST consecutive digit sequence in filename
$allDigitsRegex = [regex]'(\d+)'

$method1Found = 0
$method2Found = 0
$notFound = 0
$noDigits = 0
$tooShort = 0

$tableRows = @()
$fileIndex = 0
$excludedCount = 0

foreach ($file in $allFiles) {
    $fileIndex++
    $fileNameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $relativePath = $file.FullName.Substring($ReportsPath.Length).TrimStart('\')

    # Skip embedded resources (Logo1.png, Logo2.png, etc.)
    if ($fileNameWithoutExt -match '^[Ll]ogo\d*$') { $excludedCount++; continue }

    # Find ALL consecutive digit sequences in the filename
    $digitMatches = $allDigitsRegex.Matches($fileNameWithoutExt)
    
    if ($digitMatches.Count -eq 0) {
        $noDigits++
        $tableRows += "| $fileIndex | $relativePath | - | NO_DIGITS | - |"
        continue
    }

    # Get the longest digit sequence
    $longestDigits = ($digitMatches | Sort-Object { $_.Value.Length } -Descending | Select-Object -First 1).Value
    
    if ($longestDigits.Length -lt 5) {
        $tooShort++
        $tableRows += "| $fileIndex | $relativePath | $longestDigits | TOO_SHORT | - |"
        continue
    }

    $matched = $false

    # Method 1: Direct board serial match
    # Try the full digit sequence first, then first 8 digits (for backward compat)
    $serialKey = $null
    if ($longestDigits.Length -ge 8 -and $boardSerialMap.ContainsKey($longestDigits)) {
        $serialKey = $longestDigits
    } elseif ($longestDigits.Length -ge 8) {
        $first8 = $longestDigits.Substring(0, 8)
        if ($boardSerialMap.ContainsKey($first8)) {
            $serialKey = $first8
        }
    }

    if ($serialKey) {
        $method1Found++
        $productInfo = $boardSerialMap[$serialKey]
        $status = "METHOD1_FOUND"
        $productStr = "SN: $($productInfo.SerialNumber) | $($productInfo.ProductName) | snP=$($productInfo.SnProduct)"
        $matched = $true
    }

    # Method 2: Smart Search using the full digit sequence
    if (-not $matched) {
        $smartResult = Invoke-SmartSearch -SearchQuery $longestDigits -ProductSerialMap $productSerialMap
        
        if ($smartResult) {
            $method2Found++
            $status = "METHOD2_FOUND"
            $productStr = "SN: $($smartResult.SerialNumber) | $($smartResult.ProductName) | type=$($smartResult.TypeId) | gen=$($smartResult.GeneratedSerial) | snP=$($smartResult.SnProduct)"
            $matched = $true
        }
    }

    if (-not $matched) {
        $notFound++
        $status = "NOT_FOUND"
        $productStr = "-"
    }

    $tableRows += "| $fileIndex | $relativePath | $longestDigits | $status | $productStr |"
}

# Generate MD file
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$totalMatched = $method1Found + $method2Found
$mdContent = @"
# Match Report: Report Files vs Database Products

**Generated:** $dateStr
**Network folder:** `$ReportsPath`
**API:** `$ApiUrl`

## Summary

| Parameter | Value |
|-----------|-------|
| Total files in folder | **$($allFiles.Count)** |
| Method 1 - Direct board serial match | **$method1Found** |
| Method 2 - Smart Search (serialSearch.ts) | **$method2Found** |
| **Total matched** | **$totalMatched** |
| Not found in DB | **$notFound** |
| No digit sequences found | **$noDigits** |
| Digit sequence too short (<5 chars) | **$tooShort** |
| Products in DB (Controller+Modules+PAZ) | **$totalProducts** |
| With board serial number | **$($boardSerialMap.Count)** |
| Excluded (Logo embedded resources) | **$excludedCount** |

## Full File Table

| # | File | Digit Sequence | Status | Product |
|---|------|---------------|--------|---------|
$($tableRows -join "`n")
"@

$mdContent | Out-File -FilePath $OutputFile -Encoding utf8 -Force
Write-Host "`n[OK] Report saved: $OutputFile"
Write-Host "     Size: $((Get-Item $OutputFile).Length) bytes"

Write-Host "`n========== SUMMARY ==========" -ForegroundColor Magenta
Write-Host "Total files: $($allFiles.Count)" -ForegroundColor Cyan
Write-Host "Method 1 (direct board serial): $method1Found" -ForegroundColor Cyan
Write-Host "Method 2 (smart search): $method2Found" -ForegroundColor Cyan
Write-Host "Total matched: $totalMatched" -ForegroundColor Green
Write-Host "Not found: $notFound" -ForegroundColor Yellow
Write-Host "No digits: $noDigits" -ForegroundColor Yellow
Write-Host "Too short: $tooShort" -ForegroundColor Yellow
Write-Host "Excluded (Logo files): $excludedCount" -ForegroundColor Yellow
Write-Host "Products in DB: $totalProducts" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Magenta
