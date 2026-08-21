@echo off
title Intorna Pixels - Launcher
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%USERPROFILE%\IntornaLauncher\agent.ps1"
echo Intorna Launcher iniciado em segundo plano.
timeout /t 2 /nobreak >nul
