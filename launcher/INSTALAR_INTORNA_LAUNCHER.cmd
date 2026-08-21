@echo off
setlocal
title Intorna Pixels RC20 - Instalar Launcher

echo ============================================================
echo   INTORNA PIXELS RC20 - INSTALACAO DO LAUNCHER
echo ============================================================
echo.
echo Esta instalacao:
echo - NAO mostra sua API Key do WAHA
echo - gera um segredo privado somente neste notebook
echo - cria um agente local para Docker, WAHA e Cloudflare
echo - permite usar os botoes do proprio Intorna depois
echo.

set "ROOT=%USERPROFILE%\IntornaLauncher"
if not exist "%ROOT%" mkdir "%ROOT%"

copy /Y "%~dp0agent.ps1" "%ROOT%\agent.ps1" >nul
if errorlevel 1 (
  echo ERRO: nao foi possivel copiar agent.ps1.
  pause
  exit /b 1
)

if not exist "%ROOT%\config.json" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$b=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s=[Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_'); $p=(Get-Random -Minimum 100000 -Maximum 999999).ToString(); $c=[ordered]@{secret=$s;pairCode=$p;label=('Intorna Launcher - '+$env:COMPUTERNAME)}; $c|ConvertTo-Json|Set-Content -Encoding UTF8 '%ROOT%\config.json'"
)

echo.
echo Registrando inicializacao automatica...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%ROOT%'; $a=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"'+$root+'\agent.ps1\"'); $t=New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName 'IntornaPixelsLauncher' -Action $a -Trigger $t -Description 'Intorna Pixels RC20 Launcher' -Force | Out-Null" 2>nul

echo.
echo Gerando codigo de pareamento...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\agent.ps1" -PairOnly
if errorlevel 1 (
  echo.
  echo O pareamento nao conseguiu falar com o backend.
  echo Verifique a internet e execute o instalador novamente.
  pause
  exit /b 1
)

echo.
echo Iniciando Launcher em segundo plano...
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%ROOT%\agent.ps1"

echo.
echo ============================================================
echo INSTALACAO CONCLUIDA.
echo.
echo Um TXT foi aberto com um codigo de 6 numeros.
echo No Intorna:
echo Plataforma ^> Infra + Launcher ^> Parear notebook
echo ============================================================
echo.
pause
endlocal
