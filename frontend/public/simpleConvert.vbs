' Option Explicit
' Dim fso, logFile, word, logPath
' Set fso = CreateObject("Scripting.FileSystemObject")
' logPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "test_log.txt")

' Sub WriteLog(message)
'     Dim log
'     Set log = fso.OpenTextFile(logPath, 8, True)
'     log.WriteLine Now & " - " & message
'     log.Close
' End Sub

' WriteLog "Script started"
' On Error Resume Next
' Set word = CreateObject("Word.Application")
' If Err.Number <> 0 Then
'     WriteLog "Failed to create Word: " & Err.Description
'     WScript.Quit 1
' End If
' WriteLog "Word created successfully"
' word.Quit
' Set word = Nothing
' WriteLog "Script completed"



Option Explicit
Dim fso, logFile
Set fso = CreateObject("Scripting.FileSystemObject")
Set logFile = fso.OpenTextFile("test_log.txt", 8, True)
logFile.WriteLine Now & " - Minimal test script ran"
logFile.Close