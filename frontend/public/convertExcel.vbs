Option Explicit

Dim fso, folder, logFile, excel, xlTypePDF, files, file
Dim logPath, fullXlsxPath, pdfPath, wb

' Get the current directory where the script is executed
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
logPath = fso.BuildPath(folder, "excel_conversion_log.txt")

Sub WriteLog(message)
    Dim log, timestamp
    timestamp = FormatDateTime(Now, 2) & " " & FormatDateTime(Now, 3)
    Set log = fso.OpenTextFile(logPath, 8, True)
    log.WriteLine timestamp & " - " & message
    log.Close
End Sub

Call WriteLog("Script started in folder: " & folder)

' Create Excel COM object
On Error Resume Next
Set excel = CreateObject("Excel.Application")
If Err.Number <> 0 Then
    Call WriteLog("Failed to create Excel.Application COM object: " & Err.Description)
    WScript.Quit 1
End If
excel.Visible = False
excel.DisplayAlerts = False
Call WriteLog("Excel.Application COM object created successfully")
On Error GoTo 0

xlTypePDF = 0

' Get all .xlsx files in the folder
Set folder = fso.GetFolder(folder)
Set files = folder.Files
Call WriteLog("Found " & files.Count & " file(s)")

For Each file In files
    If LCase(fso.GetExtensionName(file.Name)) = "xlsx" Then
        fullXlsxPath = file.Path
        pdfPath = fso.BuildPath(folder, fso.GetBaseName(file.Name) & ".pdf")
        
        Call WriteLog("Processing file: " & fullXlsxPath)
        
        On Error Resume Next
        Set wb = excel.Workbooks.Open(fullXlsxPath)
        If Err.Number = 0 Then
            Call WriteLog("Workbook opened: " & fullXlsxPath)
            
            wb.ExportAsFixedFormat xlTypePDF, pdfPath
            Call WriteLog("Saved as PDF: " & pdfPath)
            
            wb.Close False
            Call WriteLog("Workbook closed: " & fullXlsxPath)
        Else
            Call WriteLog("Error processing '" & fullXlsxPath & "': " & Err.Description)
        End If
        On Error GoTo 0
    End If
Next

' Quit Excel and clean up
On Error Resume Next
excel.Quit
Set excel = Nothing
Call WriteLog("Excel application quit and COM resources released")
On Error GoTo 0

Call WriteLog("Conversion completed")
