@echo off
echo ========================================
echo BUILD DO-EAT BORNE - ELECTRON
echo ========================================

echo.
echo [1/3] Export du projet React Native vers Web...
cd born_dz
call npx expo export --platform web
if errorlevel 1 (
    echo ERREUR lors de l'export web !
    pause
    exit /b 1
)

echo.
echo [1.5/3] Copie depuis dist vers web-build...
if exist web-build rmdir /S /Q web-build
xcopy /E /I /Y dist web-build
if errorlevel 1 (
    echo ERREUR lors de la copie dist vers web-build !
    pause
    exit /b 1
)

echo.
echo [2/3] Copie du build web vers Electron...
xcopy /E /I /Y web-build ..\my-desktop-app\web-build
if errorlevel 1 (
    echo ERREUR lors de la copie !
    pause
    exit /b 1
)

echo.
echo [3/3] Creation de l'executable Windows...
cd ..\my-desktop-app
call npm run build
if errorlevel 1 (
    echo ERREUR lors du build Electron !
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD TERMINE !
echo ========================================
echo.
echo Votre .exe se trouve dans : my-desktop-app\dist\
echo.
pause