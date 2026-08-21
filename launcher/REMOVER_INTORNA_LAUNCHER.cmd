@echo off
title Intorna Pixels - Remover Launcher
echo Esta acao remove somente o Launcher local. Nao desconecta seu WhatsApp.
choice /C SN /M "Deseja continuar"
if errorlevel 2 exit /b
schtasks /Delete /TN "IntornaPixelsLauncher" /F >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -like '*IntornaLauncher*agent.ps1*'} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force}" >nul 2>&1
rmdir /S /Q "%USERPROFILE%\IntornaLauncher"
echo Launcher local removido.
pause
