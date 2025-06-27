# Укажи путь к сетевой папке
$folder = Get-Location # ← замени на нужный UNC путь

# Название временного диска (можно Z, но на всякий случай проверим)
$driveLetter = "Z"

# Проверка, не занят ли уже диск Z:
if (Get-PSDrive -Name $driveLetter -ErrorAction SilentlyContinue) {
    Write-Host "Диск $driveLetter: уже используется. Завершение." -ForegroundColor Red
    exit 1
}

# Создание PS-диска
try {
    New-PSDrive -Name $driveLetter -PSProvider FileSystem -Root $folder -Scope Script | Out-Null
    Write-Host "Сетевой диск $driveLetter: успешно подключён к $folder" -ForegroundColor Green
} catch {
    Write-Host "Ошибка при подключении сетевой папки: $_" -ForegroundColor Red
    exit 1
}

# Переход в сетевую папку
Set-Location "$driveLetter:`"

# Запуск скрипта из сетевой папки
$scriptPath = ".\script.ps1"

if (Test-Path $scriptPath) {
    try {
        Write-Host "Запуск скрипта $scriptPath..." -ForegroundColor Cyan
        & $scriptPath
    } catch {
        Write-Host "Ошибка при выполнении скрипта: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Скрипт $scriptPath не найден в папке $folder" -ForegroundColor Yellow
}

# Возврат обратно в предыдущую директорию
Pop-Location

# Удаление PS-диска
try {
    Remove-PSDrive -Name $driveLetter -Force
    Write-Host "Сетевой диск $driveLetter: отключён" -ForegroundColor Green
} catch {
    Write-Host "Ошибка при отключении сетевого диска: $_" -ForegroundColor Red
}
