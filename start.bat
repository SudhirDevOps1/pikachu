@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Pika AI Assistant v4.0 - Launcher
color 0B

:: ===========================================================================
::  Pika AI Assistant v4.0 - Production Launcher (Windows 10/11)
:: ===========================================================================

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

cls
echo.
echo ====================================================
echo                  PIKA AI ASSISTANT                  
echo ====================================================
echo.

echo [1/6] Checking Python...
set "PY_CMD="
where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=py -3"
    goto py_found
)
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python"
    goto py_found
)
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python3"
    goto py_found
)

echo [ERROR] Python not found!
pause
exit /b 1

:py_found
for /f "tokens=*" %%i in ('%PY_CMD% --version 2^>^&1') do set PY_VER=%%i
echo [OK] %PY_VER%

echo [2/6] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%
echo.

echo [3/6] Setting up Virtual Environment (venv)...
if not exist "%PROJECT_DIR%\venv\Scripts\python.exe" (
    %PY_CMD% -m venv "%PROJECT_DIR%\venv"
)
set "VENV_PY=%PROJECT_DIR%\venv\Scripts\python.exe"
echo [OK] venv ready
echo.

echo [4/6] Installing Python packages...
if exist "%PROJECT_DIR%\requirements.txt" (
    "%VENV_PY%" -m pip install --upgrade pip --disable-pip-version-check >nul 2>&1
    "%VENV_PY%" -m pip install -r "%PROJECT_DIR%\requirements.txt" --disable-pip-version-check
)
echo [OK] Python packages ready
echo.

echo [5/6] Installing Node packages...
if not exist "node_modules" (
    call npm install --loglevel=error >nul 2>&1
)
echo [OK] Node packages ready
echo.

echo [6/7] Checking and downloading models (One-time)...
if exist "%PROJECT_DIR%\setup_models.py" (
    "%VENV_PY%" "%PROJECT_DIR%\setup_models.py"
)
echo [OK] Models ready
echo.

echo [7/7] Starting PC Bridge and Web UI...
if exist "%PROJECT_DIR%\pc_bridge.py" (
    start "Pika AI - PC Bridge" cmd /c "title Pika PC Bridge [ws://localhost:8765] && color 0A && chcp 65001 >nul && "%VENV_PY%" pc_bridge.py & pause"
    echo [OK] PC Bridge started in a new window
)
echo.

:: LAN IP detect for mobile access
set "LAN_IP=YOUR_PC_IP"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set "LAN_IP=%%i"
    set "LAN_IP=!LAN_IP: =!"
    goto gotip
)
:gotip

echo ====================================================
echo ALL SYSTEMS GO!
echo Web UI:     http://localhost:3000
echo PC Bridge:  ws://localhost:8765
echo PHONE IP:   http://!LAN_IP!:3000
echo ====================================================
echo.

:: Launch Web UI in a new window
start "Pika AI - Web UI (Vite)" cmd /c "title Pika Web UI [http://localhost:3000] && color 0D && npm run dev & pause"

:: Wait 3 seconds for Vite to start before opening the browser
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

exit
