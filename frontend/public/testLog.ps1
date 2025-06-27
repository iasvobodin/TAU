$logPath = Join-Path $PSScriptRoot "neutralino_test.log"
Add-Content -Path $logPath -Value "$(Get-Date) : Script executed successfully"