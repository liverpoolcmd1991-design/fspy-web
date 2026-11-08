@echo off
title fSpy Studio — One-Click Launcher
cd /d "%~dp0"

echo ========================================================
echo   fSpy Studio — Camera Matching ^& 3D Reconstruction
echo ========================================================
echo.

:: 1. Check if Node.js / npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js was not found on your PC.
    echo [*] Attempting automatic install via Windows Package Manager ^(winget^)...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [!] Please install Node.js LTS from https://nodejs.org/ and double-click this file again.
        start https://nodejs.org/
        pause
        exit /b 1
    )
    echo.
    echo [+] Node.js installed! Please close this window and double-click start-fspy-studio.bat again.
    pause
    exit /b 0
)

:: 2. Install dependencies automatically on first run
if not exist "node_modules\" (
    echo [*] First-time setup: Installing packages ^(this takes ~30 seconds^)...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [!] Package installation failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo.
)

:: 3. Open browser and launch fSpy Studio on port 3000
echo [*] Launching fSpy Studio at http://localhost:3000 ...
echo [*] Keep this window open while using the app. Press Ctrl+C to stop.
echo.
start "" "http://localhost:3000"
call npm run dev
pause
