@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ==========================================
REM 🚀 SCRIPT DE BUILD AUTOMATIQUE DO-EAT
REM ==========================================

echo =========================================
echo   🍽️  BUILD DO-EAT BORNE AUTOMATIQUE
echo =========================================
echo.

REM ==========================================
REM CONFIGURATION - CHANGE ICI SI NÉCESSAIRE
REM ==========================================
set "REACT_PROJECT=..\born_dz"
set "ELECTRON_PROJECT=%cd%"

REM ==========================================
REM ÉTAPE 1 : Vérifier electron-builder
REM ==========================================
echo 📦 [1/5] Verification d'electron-builder...
npm list electron-builder >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  electron-builder manquant, installation...
    call npm install --save-dev electron-builder --force
    if errorlevel 1 (
        echo    ❌ Erreur: Installation echouee
        pause
        exit /b 1
    )
) else (
    echo    ✅ electron-builder installe
)
echo.

REM ==========================================
REM ÉTAPE 2 : Démarrer Metro Bundler
REM ==========================================
echo 🔥 [2/5] Demarrage de Metro Bundler...
cd /d "%REACT_PROJECT%"
if errorlevel 1 (
    echo    ❌ Erreur: Dossier React introuvable: %REACT_PROJECT%
    echo    Modifiez la ligne 16 du script avec le bon chemin
    pause
    exit /b 1
)

REM Tuer les anciens processus Metro
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *metro*" >nul 2>&1
timeout /t 1 /nobreak >nul

REM Démarrer Metro en arrière-plan
echo    Lancement de Metro...
start /B "Metro Bundler" cmd /c "npx expo start --clear > metro.log 2>&1"
timeout /t 2 /nobreak >nul
echo    ✅ Metro demarre
echo.

REM ==========================================
REM ÉTAPE 3 : Attendre que Metro soit prêt
REM ==========================================
echo ⏳ [3/5] Attente du demarrage de Metro...
set MAX_WAIT=60
set COUNTER=0

:WAIT_LOOP
if %COUNTER% geq %MAX_WAIT% (
    echo.
    echo    ❌ Timeout: Metro n'a pas demarre
    taskkill /F /IM node.exe >nul 2>&1
    pause
    exit /b 1
)

REM Vérifier si Metro répond
curl -s http://localhost:8081/status 2>nul | find "packager-status:running" >nul
if not errorlevel 1 (
    echo    ✅ Metro est pret !
    goto METRO_READY
)

if %COUNTER%==0 echo    Attente...
set /a COUNTER+=1
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:METRO_READY
echo.

REM ==========================================
REM ÉTAPE 4 : Nettoyer l'ancien build
REM ==========================================
cd /d "%ELECTRON_PROJECT%"
echo 🧹 [4/5] Nettoyage de l'ancien build...
if exist "dist\" (
    rmdir /s /q dist
    echo    ✅ Dossier dist supprime
) else (
    echo    ℹ️  Pas de dossier dist a nettoyer
)
echo.

REM ==========================================
REM ÉTAPE 5 : Builder l'exécutable
REM ==========================================
echo 🏗️  [5/5] Build de l'executable Electron...
echo    ⏱️  Cela peut prendre 5-10 minutes...
echo.

call npm run build
set BUILD_STATUS=%errorlevel%

REM ==========================================
REM ÉTAPE 6 : Arrêter Metro
REM ==========================================
echo.
echo 🛑 Arret de Metro Bundler...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Metro Bundler" >nul 2>&1
timeout /t 1 /nobreak >nul

REM ==========================================
REM RÉSULTAT
REM ==========================================
echo.
echo =========================================

if %BUILD_STATUS%==0 (
    echo   ✅ BUILD TERMINE AVEC SUCCES !
    echo =========================================
    echo.
    echo 📂 Fichiers generes :
    dir /b dist\*.exe 2>nul
    if errorlevel 1 (
        echo    ⚠️  Aucun .exe trouve
    )
    echo.
    echo 📍 Emplacement : %cd%\dist\
    echo.
    echo 💡 Pour installer : Double-cliquer sur le .exe dans dist/
) else (
    echo   ❌ BUILD ECHOUE
    echo =========================================
    echo.
    echo ❌ Le build a rencontre une erreur
    echo.
    echo Solutions possibles :
    echo 1. Verifier que Metro tourne : http://localhost:8081
    echo 2. npm cache clean --force
    echo 3. npm rebuild serialport
    echo 4. Supprimer node_modules et reinstaller
)

echo.
pause