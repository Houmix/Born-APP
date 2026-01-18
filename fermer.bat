@echo off
chcp 65001 > nul
color 0C
title Arret Do-Eat

echo ========================================
echo    Arret Do-Eat
echo ========================================
echo.

echo Arret des processus en cours...
echo.

REM Arrêter Node.js (Expo)
echo [1/2] Arret d'Expo (Node.js)...
taskkill /F /IM node.exe 2>nul
if "%ERRORLEVEL%"=="0" (
    echo [OK] Expo arrete
) else (
    echo [INFO] Expo n'etait pas en cours
)
echo.

REM Arrêter Electron
echo [2/2] Arret d'Electron...
taskkill /F /IM electron.exe 2>nul
if "%ERRORLEVEL%"=="0" (
    echo [OK] Electron arrete
) else (
    echo [INFO] Electron n'etait pas en cours
)
echo.

REM Vérifier et libérer le port 8081
echo Verification des ports...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8081" ^| find "LISTENING"') do (
    echo Liberation du port 8081...
    taskkill /F /PID %%a 2>nul
)

echo.
echo ========================================
echo [OK] Tous les services sont arretes
echo ========================================
echo.
pause