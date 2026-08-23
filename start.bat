@echo off
setlocal EnableDelayedExpansion
title Pika AI Assistant - Production Launcher
color 0B

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

cls
echo.
echo ====================================================================
echo                   PIKA AI ASSISTANT v1.0.0
echo          Personal PC AI Assistant - Hindi, English, Hinglish
echo ====================================================================
echo.

REM ---------------------------------------------------------------------
REM [1/7] CHECK PYTHON
REM ---------------------------------------------------------------------
echo [1/7] Checking Python installation...
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

echo [!] Python not found! Attempting auto-install via winget...
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Installing Python 3.12 via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    set "PY_CMD=python"
    goto py_found
) else (
    echo [ERROR] Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

:py_found
for /f "tokens=*" %%i in ('%PY_CMD% --version 2^>^&1') do set "PY_VER=%%i"
echo [OK] Found %PY_VER%

REM ---------------------------------------------------------------------
REM [2/7] CHECK NODE.JS
REM ---------------------------------------------------------------------
echo [2/7] Checking Node.js installation...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found! Attempting auto-install via winget...
    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [*] Installing Node.js LTS via winget...
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
REM [3/7] VIRTUAL ENVIRONMENT (VENV)
REM ---------------------------------------------------------------------
echo [3/7] Preparing Python Virtual Environment venv...
set "VENV_DIR=%PROJECT_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

if not exist "%VENV_PY%" (
    echo [*] Creating isolated virtual environment...
    %PY_CMD% -m venv "%VENV_DIR%"
)
if exist "%VENV_PY%" (
    set "USE_PY=%VENV_PY%"
) else (
    set "USE_PY=%PY_CMD%"
)
echo [OK] Python runtime ready

REM ---------------------------------------------------------------------
REM [4/7] PYTHON DEPENDENCIES
REM ---------------------------------------------------------------------
echo [4/7] Checking Python libraries...
set "REQ_STAMP=%VENV_DIR%\.requirements_installed"
if not exist "%REQ_STAMP%" (
    echo [*] Installing required Python packages...
    "%USE_PY%" -m pip install --upgrade pip --quiet --disable-pip-version-check
    "%USE_PY%" -m pip install -r "%PROJECT_DIR%\requirements.txt" --disable-pip-version-check
    if %ERRORLEVEL% EQU 0 (
        echo installed > "%REQ_STAMP%"
    )
)
echo [OK] Python packages ready

REM ---------------------------------------------------------------------
REM [5/7] FRONTEND DEPENDENCIES
REM ---------------------------------------------------------------------
echo [5/7] Checking frontend packages...
if not exist "%PROJECT_DIR%\node_modules" (
    echo [*] Installing frontend packages via npm...
    call npm install --loglevel=error
)
echo [OK] Frontend packages ready

REM ---------------------------------------------------------------------
REM [6/7] OFFLINE VOICE & AI MODELS
REM ---------------------------------------------------------------------
echo [6/7] Checking offline voice models...
if exist "%PROJECT_DIR%\setup_models.py" (
    if not exist "%PROJECT_DIR%\models\hi\am" (
        if not exist "%PROJECT_DIR%\models\vosk\am" (
            "%USE_PY%" "%PROJECT_DIR%\setup_models.py"
        )
    )
)
echo [OK] Voice models ready

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
REM [7/7] START SERVERS & LAUNCH APPLICATION
REM ---------------------------------------------------------------------
echo [7/7] Starting Pika AI Assistant...

set "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set "LAN_IP=%%i"
    set "LAN_IP=!LAN_IP: =!"
    goto got_lan_ip
)
:got_lan_ip

echo.
echo ====================================================================
echo   ALL SYSTEMS GO! PIKA IS READY
echo --------------------------------------------------------------------
echo   Web App URL:     http://localhost:3000
echo   Bridge Server:   ws://localhost:8765
echo   Mobile IP:       http://!LAN_IP!:3000
echo   Global Command:  Type 'pika' anywhere in terminal!
echo ====================================================================
echo.

if exist "pc_bridge.py" (
    start "Pika AI - PC Bridge" "%USE_PY%" pc_bridge.py
    echo [OK] PC Bridge started on ws://localhost:8765
)

start "Pika AI - Web UI" cmd /k npm run dev
echo [OK] Web UI server starting...

REM Wait 2 seconds using ping (safe on all Windows environments)
ping 127.0.0.1 -n 3 >nul 2>&1
start "" "http://localhost:3000"

echo [SUCCESS] Pika AI started successfully!
