Option Explicit

Dim fso, shell, wordApp, doc
Dim currentFolder, inputFile, outputFile, log, fileName, baseName
Dim startTime, endTime, errNumber, errDescription

' Инициализация объектов
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
startTime = Now

' Получение текущей папки скрипта
currentFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' Проверка аргументов
If WScript.Arguments.Count = 0 Then
    WScript.Echo "ERROR: Не передано имя файла DOCX."
    WScript.Quit 1
End If

fileName = WScript.Arguments(0)

' Проверка расширения файла
If LCase(fso.GetExtensionName(fileName)) <> "docx" Then
    WScript.Echo "ERROR: Файл должен иметь расширение .docx."
    WScript.Quit 1
End If

' Формирование пути к входному файлу
If fso.FileExists(fileName) Then
    inputFile = fileName ' Используем как абсолютный путь
Else
    inputFile = fso.BuildPath(currentFolder, fileName) ' Формируем путь относительно папки скрипта
End If

' Формирование пути к выходному файлу
baseName = fso.GetBaseName(fileName)
outputFile = fso.BuildPath(currentFolder, baseName & ".pdf")

' Открытие лога
Set log = fso.OpenTextFile(fso.BuildPath(currentFolder, "convert_log.txt"), 8, True)
log.WriteLine startTime & " - Script started"
log.WriteLine "Script path: " & WScript.ScriptFullName
log.WriteLine "Current folder: " & currentFolder
log.WriteLine "Argument received: " & fileName
log.WriteLine "Input file path: " & inputFile
log.WriteLine "Output file path: " & outputFile

' Проверка существования входного файла
If Not fso.FileExists(inputFile) Then
    log.WriteLine Now & " - ERROR: DOCX file not found at " & inputFile
    log.Close
    WScript.Quit 1
End If

' Проверка прав доступа к файлу
On Error Resume Next
Dim testFile : Set testFile = fso.OpenTextFile(inputFile, 1, False)
If Err.Number <> 0 Then
    log.WriteLine Now & " - ERROR: Cannot access DOCX file. " & Err.Description
    log.Close
    WScript.Quit 1
End If
testFile.Close
On Error GoTo 0

' Создание объекта Word
On Error Resume Next
Set wordApp = CreateObject("Word.Application")
If Err.Number <> 0 Or wordApp Is Nothing Then
    errNumber = Err.Number
    errDescription = Err.Description
    log.WriteLine Now & " - ERROR: Could not create Word.Application. Error " & errNumber & ": " & errDescription
    log.Close
    WScript.Quit 1
End If
On Error GoTo 0

' Проверка версии Word
log.WriteLine "Word version: " & wordApp.Version
If wordApp.Version < "12.0" Then
    log.WriteLine Now & " - ERROR: Word version " & wordApp.Version & " does not support PDF export."
    wordApp.Quit
    log.Close
    WScript.Quit 1
End If

wordApp.Visible = False

' Открытие документа
On Error Resume Next
Set doc = wordApp.Documents.Open(inputFile, False, True)
If Err.Number <> 0 Or doc Is Nothing Then
    errNumber = Err.Number
    errDescription = Err.Description
    log.WriteLine Now & " - ERROR: Could not open DOCX file. Error " & errNumber & ": " & errDescription
    If Not wordApp Is Nothing Then wordApp.Quit
    log.Close
    WScript.Quit 1
End If
On Error GoTo 0

' Экспорт в PDF
On Error Resume Next
doc.ExportAsFixedFormat outputFile, 17 ' 17 = wdExportFormatPDF
If Err.Number <> 0 Then
    errNumber = Err.Number
    errDescription = Err.Description
    log.WriteLine Now & " - ERROR: Export to PDF failed. Error " & errNumber & ": " & errDescription
Else
    log.WriteLine Now & " - SUCCESS: Exported to PDF at " & outputFile
End If
On Error GoTo 0

' Проверка существования PDF
If fso.FileExists(outputFile) Then
    log.WriteLine Now & " - SUCCESS: PDF file exists at " & outputFile
Else
    log.WriteLine Now & " - ERROR: PDF file not found after export at " & outputFile
End If

' Закрытие документа и Word
If Not doc Is Nothing Then
    doc.Close False
    log.WriteLine Now & " - Document closed"
End If
If Not wordApp Is Nothing Then
    wordApp.Quit
    log.WriteLine Now & " - Word application closed"
End If

' Завершение
endTime = Now
log.WriteLine endTime & " - Script finished. Execution time: " & DateDiff("s", startTime, endTime) & " seconds"
log.Close

WScript.Quit 0