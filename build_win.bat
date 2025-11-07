@echo off
echo ARGUS Windows Quick Build
echo =========================
echo.

REM Clean old builds
if exist dist rmdir /s /q dist
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build
echo Building Windows installer...
call npm run dist-win

echo.
echo Build complete!
echo Check dist folder for: ARGUS Setup 2.0.0.exe
pause
