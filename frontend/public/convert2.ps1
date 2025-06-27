param (
    [Parameter(Mandatory=$true)]
    [string]$FileName
)

$ErrorActionPreference = "SilentlyContinue"

# Получаем текущую папку скрипта
$currentFolder = Split-Path -Parent $MyInvocation.MyCommand.Definition
$inputFile = Join-Path $currentFolder $FileName
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
$outputFile = Join-Path $currentFolder ($baseName + ".pdf")
$logFile = Join-Path $currentFolder "convert_log.txt"

# Открываем лог
Add-Content -Path $logFile -Value "$(Get-Date) - Script started"
Add-Content -Path $logFile -Value "Input file: $inputFile"
Add-Content -Path $logFile -Value "Output file: $outputFile"

# Проверка наличия файла
if (-not (Test-Path $inputFile)) {
    Add-Content -Path $logFile -Value "$(Get-Date) - ERROR: DOCX file not found."
    exit 1
}

# Создание COM-объекта Word
$wordApp = New-Object -ComObject Word.Application
if (-not $wordApp) {
    Add-Content -Path $logFile -Value "$(Get-Date) - ERROR: Could not create Word.Application."
    exit 1
}

$wordApp.Visible = $false

# Открываем документ
$doc = $wordApp.Documents.Open($inputFile, $false, $true)
if (-not $doc) {
    Add-Content -Path $logFile -Value "$(Get-Date) - ERROR: Could not open DOCX file."
    $wordApp.Quit()
    exit 1
}

# Экспорт в PDF (17 = wdExportFormatPDF)
$doc.ExportAsFixedFormat($outputFile, 17)

if (-not (Test-Path $outputFile)) {
    Add-Content -Path $logFile -Value "$(Get-Date) - ERROR: Export to PDF failed."
} else {
    Add-Content -Path $logFile -Value "$(Get-Date) - SUCCESS: Exported to PDF."
}

# Закрываем документ и Word
$doc.Close($false)
$wordApp.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wordApp) | Out-Null
Remove-Variable wordApp, doc

# Печать PDF — раскомментируйте при необходимости
<# 
if (Test-Path $outputFile) {
    Start-Process -FilePath $outputFile -Verb Print
    Add-Content -Path $logFile -Value "$(Get-Date) - SUCCESS: Sent to printer."
} else {
    Add-Content -Path $logFile -Value "$(Get-Date) - ERROR: PDF file not found after export."
}
#>

Add-Content -Path $logFile -Value "$(Get-Date) - Script finished."
exit 0
