# # Set strict mode
# Set-StrictMode -Version Latest

# # Get current script directory
# $folder = Split-Path -Parent $MyInvocation.MyCommand.Definition

# $logPath = Join-Path $folder "conversion_log.txt"

# function Write-Log {
#     param([string]$message)
#     $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
#     Add-Content -Path $logPath -Value "$timestamp - $message"
# }

# Write-Log "Script started in folder: $folder"

# # Create Word COM object
# try {
#     $word = New-Object -ComObject Word.Application
#     $word.Visible = $false
#     $word.DisplayAlerts = 0
#     Write-Log "Word.Application COM object created successfully"
# } catch {
#     Write-Log "Failed to create Word.Application COM object: $_"
#     exit 1
# }

# $wdFormatPDF = 17

# # Get all .docx files in the folder as array
# $files = @(Get-ChildItem -Path $folder -Filter *.docx)
# Write-Log "Found $($files.Count) .docx file(s)"

# if ($files.Count -eq 0) {
#     Write-Log "No .docx files found. Exiting."
#     try {
#         $word.Quit()
#         [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
#         Remove-Variable word
#         Write-Log "Word application quit and COM resources released"
#     } catch {
#         Write-Log "Error during Word cleanup: $_"
#     }
#     exit
# }

# foreach ($file in $files) {
#     $fullDocxPath = $file.FullName
#     $pdfPath = [System.IO.Path]::ChangeExtension($fullDocxPath, ".pdf")

#     Write-Log "Processing file: $fullDocxPath"
#     try {
#         $doc = $word.Documents.Open($fullDocxPath)
#         Write-Log "Document opened: $fullDocxPath"

#         $doc.SaveAs([ref] $pdfPath, [ref] $wdFormatPDF)
#         Write-Log "Saved as PDF: $pdfPath"

#         $doc.Close()
#         Write-Log "Document closed: $fullDocxPath"
#     } catch {
#         Write-Log "Error processing '$fullDocxPath': $_"
#     }
# }

# # Quit Word
# try {
#     $word.Quit()
#     [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
#     Remove-Variable word
#     Write-Log "Word application quit and COM resources released"
# } catch {
#     Write-Log "Error during Word cleanup: $_"
# }

# Write-Log "Conversion completed"




Set-StrictMode -Version Latest

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$folder = Split-Path -Parent $MyInvocation.MyCommand.Definition
$logPath = Join-Path $folder "conversion_log.txt"

function Write-Log {
    param([string]$message)
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logPath -Value "$timestamp - $message"
}

Write-Log "Script started in folder: $folder"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    Write-Log "Word.Application COM object created successfully"
} catch {
    Write-Log "Failed to create Word.Application COM object: $_"
    exit 1
}

$wdFormatPDF = 17
$files = @(Get-ChildItem -Path $folder -Filter *.docx)
Write-Log "Found $($files.Count) .docx file(s)"

if ($files.Count -eq 0) {
    Write-Log "No .docx files found. Exiting."
    try {
        $word.Quit()
        Remove-Variable word
        Write-Log "Word application quit"
    } catch {
        Write-Log "Error during Word cleanup: $_"
    }
    exit
}

foreach ($file in $files) {
    $fullDocxPath = $file.FullName
    $pdfPath = [System.IO.Path]::ChangeExtension($fullDocxPath, ".pdf")

    Write-Log "Processing file: $fullDocxPath"
    try {
        $doc = $word.Documents.Open($fullDocxPath)
        Write-Log "Document opened: $fullDocxPath"

        $doc.SaveAs([ref] $pdfPath, [ref] $wdFormatPDF)
        Write-Log "Saved as PDF: $pdfPath"

        $doc.Close()
        Write-Log "Document closed: $fullDocxPath"
    } catch {
        Write-Log "Error processing '$fullDocxPath': $_"
    }
}

try {
    $word.Quit()
    # Не вызываем ReleaseComObject — иногда вызывает крахи
    Remove-Variable word
    Write-Log "Word application quit and resources released"
} catch {
    Write-Log "Error during Word cleanup: $_"
}

Write-Log "Conversion completed"

# Даем небольшую задержку для завершения COM операций
Start-Sleep -Seconds 1
