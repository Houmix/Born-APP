@echo off
chcp 65001 > nul
color 0A
title Lancement Do-Eat

echo ========================================
echo    Lancement Do-Eat
echo ========================================
echo.

REM Sauvegarder le répertoire du script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo Repertoire de travail: %SCRIPT_DIR%
echo.

REM 1. Lancer Expo dans born_dz
echo [1/2] Lancement d'Expo (born_dz)...

if not exist "born_dz" (
    color 0C
    echo [ERREUR] Dossier born_dz introuvable
    echo Assurez-vous que ce script est a la racine du projet
    pause
    exit /b 1
)

cd born_dz

REM Vérifier node_modules
if not exist "node_modules" (
    echo Installation des dependances npm...
    call npm install
)

REM Lancer Expo dans une nouvelle fenêtre
start "Do-Eat Expo" cmd /k "title Do-Eat Expo ^& echo Demarrage Expo... ^& npx expo start --clear"
timeout /t 2 /nobreak > nul
echo [OK] Expo lance dans une nouvelle fenetre
echo.

cd /d "%SCRIPT_DIR%"

REM 2. Attendre qu'Expo soit prêt
echo [Attente] Demarrage d'Expo en cours (15 secondes)...
timeout /t 15 /nobreak > nul

REM 3. Lancer Electron dans my-desktop-app
echo [2/2] Lancement d'Electron (my-desktop-app)...

if not exist "my-desktop-app" (
    color 0C
    echo [ERREUR] Dossier my-desktop-app introuvable
    pause
    exit /b 1
)

cd my-desktop-app

REM Vérifier node_modules
if not exist "node_modules" (
    echo Installation des dependances npm...
    call npm install
)

REM Lancer Electron dans une nouvelle fenêtre
start "Do-Eat Electron" cmd /k "title Do-Eat Electron ^& echo Demarrage Electron... ^& npm start"
timeout /t 2 /nobreak > nul
echo [OK] Electron lance dans une nouvelle fenetre
echo.

cd /d "%SCRIPT_DIR%"

REM Résumé
echo ========================================
echo [OK] Tous les services sont lances !
echo ========================================
echo.
echo Expo:     Voir la fenetre "Do-Eat Expo"
echo Electron: Voir la fenetre "Do-Eat Electron"
echo.
echo Vous pouvez fermer cette fenetre
echo.
timeout /t 5 /nobreak > nul