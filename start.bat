@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Pika AI Assistant - Production Launcher
color 0B

:: ===========================================================================
::  ⚡ PIKA AI ASSISTANT — One-Click Production Launcher (Windows 10/11)
:: ===========================================================================

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

cls
echo.
echo ====================================================================
echo                   ⚡  PIKA AI ASSISTANT v1.0.0                       
echo          Personal PC AI Assistant (Hindi, English, Hinglish)         
echo ====================================================================
echo.

:: ───────────────────────────────────────────────────────────────────────────
:: [1/7] CHECK PYTHON
:: ───────────────────────────────────────────────────────────────────────────
echo [1/7] Python check kar rahe hain...
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

echo [!] Python nahi mila! Winget se auto-install kar rahe hain...
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Downloading and installing Python 3.12 via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    set "PY_CMD=python"
    goto py_found
) else (
    echo [ERROR] Python 3.10+ install karein https://python.org se (Add to PATH tick karein)
    pause
    exit /b 1
)

:py_found
for /f "tokens=*" %%i in ('%PY_CMD% --version 2^>^&1') do set PY_VER=%%i
echo [OK] %PY_VER% mil gaya

:: ───────────────────────────────────────────────────────────────────────────
:: [2/7] CHECK NODE.JS
:: ───────────────────────────────────────────────────────────────────────────
echo [2/7] Node.js check kar rahe hain...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js nahi mila! Winget se auto-install kar rahe hain...
    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [*] Installing Node.js LTS via winget...
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    ) else (
        echo [ERROR] Node.js 18+ install karein https://nodejs.org se
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('node -v 2^>^&1') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% mil gaya

:: ───────────────────────────────────────────────────────────────────────────
:: [3/7] VIRTUAL ENVIRONMENT (VENV)
:: ───────────────────────────────────────────────────────────────────────────
echo [3/7] Python Virtual Environment (venv) tayyar kar rahe hain...
set "VENV_DIR=%PROJECT_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

if not exist "%VENV_PY%" (
    echo [*] Naya isolated venv ban raha hai...
    %PY_CMD% -m venv "%VENV_DIR%"
)
if exist "%VENV_PY%" (
    set "USE_PY=%VENV_PY%"
) else (
    set "USE_PY=%PY_CMD%"
)
echo [OK] Python runtime ready

:: ───────────────────────────────────────────────────────────────────────────
:: [4/7] PYTHON DEPENDENCIES (One-Time / Stamp Checked)
:: ───────────────────────────────────────────────────────────────────────────
echo [4/7] Python libraries check ho rahi hain...
set "REQ_STAMP=%VENV_DIR%\.requirements_installed"
if not exist "%REQ_STAMP%" (
    echo [*] Pehli baar zaroori packages download aur install ho rahe hain...
    "%USE_PY%" -m pip install --upgrade pip --quiet --disable-pip-version-check
    "%USE_PY%" -m pip install -r "%PROJECT_DIR%\requirements.txt" --disable-pip-version-check
    if %ERRORLEVEL% EQU 0 (
        echo installed > "%REQ_STAMP%"
    )
)
echo [OK] Python packages ready

:: ───────────────────────────────────────────────────────────────────────────
:: [5/7] NODE DEPENDENCIES (One-Time)
:: ───────────────────────────────────────────────────────────────────────────
echo [5/7] Frontend modules check ho rahe hain...
if not exist "%PROJECT_DIR%\node_modules" (
    echo [*] Frontend dependencies (npm install) ho rahi hain...
    call npm install --loglevel=error
)
echo [OK] Frontend packages ready

:: ───────────────────────────────────────────────────────────────────────────
:: [6/7] OFFLINE VOICE & AI MODELS (One-Time Setup)
:: ───────────────────────────────────────────────────────────────────────────
echo [6/7] Voice & AI models check ho rahe hain...
if exist "%PROJECT_DIR%\setup_models.py" (
    if not exist "%PROJECT_DIR%\models\hi\am" (
        if not exist "%PROJECT_DIR%\models\vosk\am" (
            "%USE_PY%" "%PROJECT_DIR%\setup_models.py"
        )
    )
)
echo [OK] Models ready

:: ───────────────────────────────────────────────────────────────────────────
:: REGISTER GLOBAL 'pika' COMMAND (Any Terminal)
:: ───────────────────────────────────────────────────────────────────────────
set "PIKA_BIN=%USERPROFILE%\.pika\bin"
if not exist "%PIKA_BIN%" (
    mkdir "%PIKA_BIN%" >nul 2>&1
)
(
    echo @echo off
    echo cd /d "%PROJECT_DIR%"
    echo call "%PROJECT_DIR%\start.bat" %%*
) > "%PIKA_BIN%\pika.cmd"

(
    echo Set-Location "%PROJECT_DIR%"
    echo & "%PROJECT_DIR%\start.bat" $args
) > "%PIKA_BIN%\pika.ps1"

:: Check if ~/.pika/bin is in User PATH, if not add it
echo %PATH% | findstr /i /c:"%USERPROFILE%\.pika\bin" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';%USERPROFILE%\.pika\bin', 'User')" >nul 2>&1
)

:: ───────────────────────────────────────────────────────────────────────────
:: [7/7] START SERVERS & OPEN APP
:: ───────────────────────────────────────────────────────────────────────────
echo [7/7] Pika AI Assistant start ho raha hai...

:: 1. Start Python PC Bridge (Backend)
if exist "%PROJECT_DIR%\pc_bridge.py" (
    start "Pika AI - PC Bridge" cmd /c "title Pika PC Bridge [ws://localhost:8765] && color 0A && chcp 65001 >nul && "%USE_PY%" pc_bridge.py"
    echo [OK] PC Bridge WebSocket (ws://localhost:8765) chalu ho gaya
)

:: 2. LAN IP detect for mobile access
set "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set "LAN_IP=%%i"
    set "LAN_IP=!LAN_IP: =!"
    goto got_ip
)
:got_ip

echo.
echo ====================================================================
echo  🚀  ALL SYSTEMS GO! PIKA IS READY
echo --------------------------------------------------------------------
echo  🌐  Web App URL:     http://localhost:3000
echo  🔌  Bridge Server:   ws://localhost:8765
echo  📱  Phone Access:    http://!LAN_IP!:3000
echo  💻  Terminal Command: Type 'pika' anywhere in CMD / PowerShell!
echo ====================================================================
echo.

:: 3. Start Frontend (Vite)
start "Pika AI - Web UI" cmd /c "title Pika Web UI [http://localhost:3000] && color 0D && npm run dev"

:: 4. Wait 2 seconds and open browser automatically
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

exit
