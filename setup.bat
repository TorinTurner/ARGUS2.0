@echo off
REM ARGUS Modern - Quick Setup Script for Windows
REM Run this to get started TONIGHT

echo =========================================
echo   ARGUS Modern - Setup
echo =========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js not found!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Python not found!
    echo Please install Python 3.8+ from: https://python.org/
    pause
    exit /b 1
)

echo [OK] Python found
python --version

echo.
echo Installing dependencies...
echo.

REM Install Node dependencies
echo [1/3] Installing Electron...
call npm install

REM Install Python dependencies
echo.
echo [2/3] Installing Python packages...
python -m pip install opencv-python numpy Pillow imageio pyyaml --break-system-packages 2>nul
if %ERRORLEVEL% NEQ 0 (
    python -m pip install opencv-python numpy Pillow imageio pyyaml
)

REM Create output directory
echo.
echo [3/3] Creating directories...
if not exist "output" mkdir output

echo.
echo =========================================
echo   Setup Complete!
echo =========================================
echo.
echo To run ARGUS:
echo   npm start
echo.
echo To package for distribution:
echo   npm run package-portable
echo.
echo Example files are in .\examples\
echo Templates are in .\templates\
echo.
pause
