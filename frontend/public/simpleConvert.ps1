# Get the current directory where the script is executed
$folder = Get-Location
$logPath = Join-Path $folder "conversion_log.txt"

function Write-Log($message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $message" | Out-File -FilePath $logPath -Append
}

Write-Log "Script started in folder: $folder"

# Create Word COM object
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

# Get all .docx files in the folder
$docxFiles = Get-ChildItem -Path $folder -Filter *.docx
Write-Log "Found $($docxFiles.Count) .docx file(s)"

foreach ($file in $docxFiles) {
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
    }
    catch {
        Write-Log "Error processing '$fullDocxPath': $_"
    }
}

# Quit Word and clean up
try {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    Write-Log "Word application quit and COM resources released"
} catch {
    Write-Log "Error during Word cleanup: $_"
}

Write-Log "Conversion completed"
