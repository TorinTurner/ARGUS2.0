@echo off
REM Build standalone Python executable for VLF Message Compressor
REM This creates a self-contained executable with Python and all dependencies bundled

echo =========================================
echo   VLF - Building Python Executable
echo =========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo X Python not found!
    echo Python is required to BUILD the executable.
    echo Install from: https://python.org/
    exit /b 1
)

echo + Python found
python --version
echo.

REM Install PyInstaller and brotli if not present
echo [1/4] Ensuring PyInstaller and dependencies are installed...
python -m pip install --quiet pyinstaller brotli

REM Clean previous builds
echo.
echo [2/4] Cleaning previous VLF builds...
if exist python\dist\VLF_core rmdir /s /q python\dist\VLF_core
if exist python\build\VLF_core rmdir /s /q python\build\VLF_core

REM Build the executable
echo.
echo [3/4] Building standalone Python executable...
echo This may take 1-2 minutes...
cd python
python -m PyInstaller VLF_core.spec --clean
cd ..

REM Check if build succeeded
if not exist "python\dist\VLF_core" (
    echo.
    echo X Build failed! VLF_core directory not found.
    exit /b 1
)

if not exist "python\dist\VLF_core\VLF_core.exe" (
    echo.
    echo X Build failed! VLF_core.exe executable not found in output directory.
    exit /b 1
)

REM Create python-dist directory and copy entire VLF_core folder
echo.
echo [4/4] Preparing for Electron bundling...
if not exist python-dist mkdir python-dist
if exist python-dist\VLF_core rmdir /s /q python-dist\VLF_core
xcopy /E /I /Q python\dist\VLF_core python-dist\VLF_core

echo.
echo =========================================
echo   VLF Executable Built Successfully!
echo =========================================
echo.
echo Location: python-dist\VLF_core\ (onedir build)
echo Structure:
echo   VLF_core\
echo   +-- VLF_core.exe
echo   +-- _internal\ (all dependencies)
echo.
echo Directory contents:
dir /B python-dist\VLF_core
echo.
echo Next steps:
echo   1. Run: npm run dist-win (for Windows)
echo   2. Your installer will be in dist\
echo.
