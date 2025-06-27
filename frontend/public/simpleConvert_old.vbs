Option Explicit

Dim fso, folder, logFile, word, wdFormatPDF, files, file
Dim logPath, fullDocxPath, pdfPath, doc

' Get the current directory where the script is executed
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
logPath = fso.BuildPath(folder, "conversion_log.txt")

Sub WriteLog(message)
    Dim log, timestamp
    timestamp = FormatDateTime(Now, 2) & " " & FormatDateTime(Now, 3)
    Set log = fso.OpenTextFile(logPath, 8, True)
    log.WriteLine timestamp & " - " & message
    log.Close
End Sub

Call WriteLog("Script started in folder: " & folder)

' Create Word COM object
On Error Resume Next
Set word = CreateObject("Word.Application")
If Err.Number <> 0 Then
    Call WriteLog("Failed to create Word.Application COM object: " & Err.Description)
    WScript.Quit 1
End If
word.Visible = False
word.DisplayAlerts = False
Call WriteLog("Word.Application COM object created successfully")
On Error GoTo 0

wdFormatPDF = 17

' Get all .docx files in the folder
Set folder = fso.GetFolder(folder)
Set files = folder.Files
Call WriteLog("Found " & files.Count & " file(s)")

For Each file In files
    If LCase(fso.GetExtensionName(file.Name)) = "docx" Then
        fullDocxPath = file.Path
        pdfPath = fso.BuildPath(folder, fso.GetBaseName(file.Name) & ".pdf")
        
        Call WriteLog("Processing file: " & fullDocxPath)
        
        On Error Resume Next
        Set doc = word.Documents.Open(fullDocxPath)
        If Err.Number = 0 Then
            Call WriteLog("Document opened: " & fullDocxPath)
            
            doc.SaveAs pdfPath, wdFormatPDF
            Call WriteLog("Saved as PDF: " & pdfPath)
            
            doc.Close
            Call WriteLog("Document closed: " & fullDocxPath)
        Else
            Call WriteLog("Error processing '" & fullDocxPath & "': " & Err.Description)
        End If
        On Error GoTo 0
    End If
Next

' Quit Word and clean up
On Error Resume Next
word.Quit
Set word = Nothing
Call WriteLog("Word application quit and COM resources released")
On Error GoTo 0

Call WriteLog("Conversion completed")