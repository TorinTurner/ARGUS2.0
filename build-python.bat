@echo off
REM Build standalone Python executable for ARGUS
REM This creates a self-contained .exe with Python and all dependencies bundled

echo =========================================
echo   ARGUS - Building Python Executable
echo =========================================
echo.

REM Check if Python is installed (needed for building only, not for deployment)
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Python not found!
    echo Python is required to BUILD the executable.
    echo Install from: https://python.org/
    pause
    exit /b 1
)

echo [OK] Python found
python --version
echo.

REM Check Python architecture (must be 64-bit for x64 builds)
python build\check-arch.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo X 32-bit Python detected! Install 64-bit Python for x64 builds.
    pause
    exit /b 1
)
echo.

REM Install PyInstaller if not present
echo [1/4] Ensuring PyInstaller is installed...
python -m pip install pyinstaller opencv-python numpy Pillow imageio pyyaml --quiet

REM Clean previous builds
echo.
echo [2/4] Cleaning previous builds...
if exist "python\dist" rmdir /s /q python\dist
if exist "python\build" rmdir /s /q python\build

REM Build the executable
echo.
echo [3/4] Building standalone Python executable...
echo This may take 2-5 minutes...
cd python
python -m PyInstaller ARGUS_core.spec --clean
cd ..

REM Check if build succeeded (onedir creates a directory, not a single exe)
if not exist "python\dist\ARGUS_core" (
    echo.
    echo X Build failed! ARGUS_core directory not found.
    pause
    exit /b 1
)

if not exist "python\dist\ARGUS_core\ARGUS_core.exe" (
    echo.
    echo X Build failed! ARGUS_core.exe not found in output directory.
    pause
    exit /b 1
)

REM Create python-dist directory and copy entire ARGUS_core folder (onedir build)
echo.
echo [4/4] Preparing for Electron bundling...
if exist "python-dist" rmdir /s /q python-dist
mkdir python-dist
xcopy python\dist\ARGUS_core python-dist\ARGUS_core\ /E /I /Q >nul

echo.
echo =========================================
echo   Python Executable Built Successfully!
echo =========================================
echo.
echo Location: python-dist\ARGUS_core\ (onedir build)
echo Structure:
echo   ARGUS_core\
echo   ├── ARGUS_core.exe
echo   └── _internal\ (all DLLs)
echo.
echo Directory contents:
dir /B python-dist\ARGUS_core
echo.
echo Next steps:
echo   1. Run: npm run dist-win
echo   2. Your installer will be in dist\
echo.
pause
