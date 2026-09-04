@echo off
chcp 65001 >nul
echo ============================================
echo  Сборка TAU Launcher
echo ============================================

echo.
echo [1/2] Восстановление пакетов...
dotnet restore Launcher.csproj
if %ERRORLEVEL% neq 0 (
    echo Ошибка восстановления пакетов!
    exit /b 1
)

echo.
echo [2/2] Компиляция...
dotnet publish Launcher.csproj -c Release -o ..\
if %ERRORLEVEL% neq 0 (
    echo Ошибка компиляции!
    exit /b 1
)

echo.
echo ============================================
echo  Готово! Launcher.exe создан в ..\
echo  Исполняемый файл: ..\TAU-Launcher.exe
echo ============================================
echo.
echo Ручное переименование (опционально):
echo   rename ..\TAU-Launcher.exe Launcher.exe
echo.
pause
