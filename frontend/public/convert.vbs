On Error Resume Next

Dim fso, shell, wordApp, doc
Dim currentFolder, inputFile, outputFile, log, fileName, baseName

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Получаем путь к текущей папке, где лежит скрипт и DOCX
currentFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' Получаем имя файла из аргумента
If WScript.Arguments.Count = 0 Then
    WScript.Echo "ERROR: Не передано имя файла DOCX."
    WScript.Quit
End If

fileName = WScript.Arguments(0)

' Абсолютный путь к DOCX
inputFile = fso.BuildPath(currentFolder, fileName)

' Имя без расширения для PDF
baseName = fso.GetBaseName(fileName)
outputFile = fso.BuildPath(currentFolder, baseName & ".pdf")

' Открываем лог
Set log = fso.OpenTextFile(fso.BuildPath(currentFolder, "convert_log.txt"), 8, True)
log.WriteLine Now & " - Script started"
log.WriteLine "Input file: " & inputFile
log.WriteLine "Output file: " & outputFile

If Not fso.FileExists(inputFile) Then
    log.WriteLine Now & " - ERROR: DOCX file not found."
    log.Close
    WScript.Quit
End If

Set wordApp = CreateObject("Word.Application")
If Err.Number <> 0 Or wordApp Is Nothing Then
    log.WriteLine Now & " - ERROR: Could not create Word.Application. " & Err.Description
    log.Close
    WScript.Quit
End If

wordApp.Visible = False
Err.Clear

Set doc = wordApp.Documents.Open(inputFile, False, True)
If Err.Number <> 0 Or doc Is Nothing Then
    log.WriteLine Now & " - ERROR: Could not open DOCX file. " & Err.Description
    wordApp.Quit
    log.Close
    WScript.Quit
End If

doc.ExportAsFixedFormat outputFile, 17
If Err.Number <> 0 Then
    log.WriteLine Now & " - ERROR: Export to PDF failed. " & Err.Description
Else
    log.WriteLine Now & " - SUCCESS: Exported to PDF."
End If

doc.Close False
wordApp.Quit

' If fso.FileExists(outputFile) Then
'     shell.Run "rundll32.exe shell32.dll,ShellExec_RunDLL """ & outputFile & """", 0, False
'     log.WriteLine Now & " - SUCCESS: Sent to printer."
' Else
'     log.WriteLine Now & " - ERROR: PDF file not found after export."
' End If

log.WriteLine Now & " - Script finished."
log.Close

WScript.Quit 0