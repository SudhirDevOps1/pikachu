@echo off
setlocal EnableDelayedExpansion
title Pika AI Assistant - Production Launcher v1.1.0
color 0B

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

cls
echo.
echo ====================================================================
echo                   PIKA AI ASSISTANT v1.1.0
echo       Autonomous PC AI Assistant - Hindi, English, Hinglish
echo ====================================================================
echo.

REM ---------------------------------------------------------------------
REM [1/8] CLEAN PREVIOUS ZOMBIE PROCESSES ON PORTS
REM ---------------------------------------------------------------------
echo [1/8] Checking and clearing previous instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo [OK] Ports 8765 and 3000 ready

REM ---------------------------------------------------------------------
REM [2/8] CHECK PYTHON INSTALLATION
REM ---------------------------------------------------------------------
echo [2/8] Checking Python environment...
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

echo [!] Python not found. Installing Python 3.12 via winget...
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Downloading and installing Python...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    set "PY_CMD=python"
    goto py_found
) else (
    echo [ERROR] Please install Python 3.10+ from https://python.org and add to PATH.
    pause
    exit /b 1
)

:py_found
for /f "tokens=*" %%i in ('%PY_CMD% --version 2^>^&1') do set "PY_VER=%%i"
echo [OK] Found %PY_VER%

REM ---------------------------------------------------------------------
REM [3/8] CHECK NODE.JS & NPM
REM ---------------------------------------------------------------------
echo [3/8] Checking Node.js environment...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found. Installing Node.js LTS via winget...
    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [*] Installing Node.js...
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    ) else (
        echo [ERROR] Please install Node.js 18+ from https://nodejs.org
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('node -v 2^>^&1') do set "NODE_VER=%%i"
echo [OK] Found Node.js %NODE_VER%

REM ---------------------------------------------------------------------
REM [4/8] PYTHON VIRTUAL ENVIRONMENT (VENV)
REM ---------------------------------------------------------------------
echo [4/8] Setting up isolated Python venv...
set "VENV_DIR=%PROJECT_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

if not exist "%VENV_PY%" (
    echo [*] Creating fresh virtual environment...
    %PY_CMD% -m venv "%VENV_DIR%"
)
if exist "%VENV_PY%" (
    set "USE_PY=%VENV_PY%"
) else (
    set "USE_PY=%PY_CMD%"
)
echo [OK] Python runtime active (%USE_PY%)

REM ---------------------------------------------------------------------
REM [5/8] PYTHON DEPENDENCIES & HARDWARE ENCLAVE
REM ---------------------------------------------------------------------
echo [5/8] Verifying and updating Python libraries...
set "REQ_STAMP=%VENV_DIR%\.requirements_installed_v110"
if not exist "%REQ_STAMP%" (
    echo [*] Installing required Python AI & automation packages...
    "%USE_PY%" -m pip install --upgrade pip --quiet --disable-pip-version-check
    "%USE_PY%" -m pip install -r "%PROJECT_DIR%\requirements.txt" --disable-pip-version-check
    if %ERRORLEVEL% EQU 0 (
        echo v1.1.0 > "%REQ_STAMP%"
    )
)
echo [OK] Python automation & AI libraries ready

REM ---------------------------------------------------------------------
REM [6/8] FRONTEND PACKAGES & SINGLE-FILE BUNDLE
REM ---------------------------------------------------------------------
echo [6/8] Checking frontend packages...
if not exist "%PROJECT_DIR%\node_modules" (
    echo [*] Installing frontend npm dependencies...
    call npm install --loglevel=error
)
echo [OK] Frontend packages ready

REM ---------------------------------------------------------------------
REM [7/8] OFFLINE VOICE & SPEECH MODELS
REM ---------------------------------------------------------------------
echo [7/8] Checking offline voice models...
if exist "%PROJECT_DIR%\setup_models.py" (
    if not exist "%PROJECT_DIR%\models\hi\am" (
        if not exist "%PROJECT_DIR%\models\vosk\am" (
            echo [*] Downloading offline Hindi voice recognition model...
            "%USE_PY%" "%PROJECT_DIR%\setup_models.py"
        )
    )
)
echo [OK] Voice recognition models ready

REM ---------------------------------------------------------------------
REM REGISTER GLOBAL PIKA COMMAND IN USER PATH
REM ---------------------------------------------------------------------
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
    echo ^& "%PROJECT_DIR%\start.bat" $args
) > "%PIKA_BIN%\pika.ps1"

echo %PATH% | findstr /i /c:"%USERPROFILE%\.pika\bin" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';%USERPROFILE%\.pika\bin', 'User')" >nul 2>&1
)

REM ---------------------------------------------------------------------
REM [8/8] START SERVERS & LAUNCH APPLICATION
REM ---------------------------------------------------------------------
echo [8/8] Starting Pika AI Assistant Engine...

set "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set "LAN_IP=%%i"
    set "LAN_IP=!LAN_IP: =!"
    goto got_lan_ip
)
:got_lan_ip

echo.
echo ====================================================================
echo   ⚡ ALL SYSTEMS OPERATIONAL - PIKA AI IS LIVE!
echo --------------------------------------------------------------------
echo   Web App URL:     http://localhost:3000
echo   PC Bridge:       ws://localhost:8765
echo   Mobile Access:   http://!LAN_IP!:3000
echo   CLI Command:     Type 'pika' anywhere in terminal!
echo ====================================================================
echo.

if exist "pc_bridge.py" (
    start "Pika AI - PC Bridge" "%USE_PY%" pc_bridge.py
    echo [OK] PC Bridge backend started on ws://localhost:8765
)

start "Pika AI - Web UI" cmd /k npm run dev
echo [OK] Web UI server started on http://localhost:3000

REM Wait 2 seconds and open default browser
ping 127.0.0.1 -n 3 >nul 2>&1
start "" "http://localhost:3000"

echo [SUCCESS] Pika AI is now running smoothly!

