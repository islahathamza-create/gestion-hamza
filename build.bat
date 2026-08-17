@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   GESTION HAMZA - BUILD WINDOWS
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Node.js n'est pas installe.
  echo Installez Node.js LTS puis relancez ce fichier.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERREUR: npm n'est pas disponible.
  pause
  exit /b 1
)

echo [1/2] Installation des dependances...
npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo ERREUR pendant npm install.
  pause
  exit /b 1
)

echo.
echo [2/2] Creation de l'installateur Windows...
npm run dist
if errorlevel 1 (
  echo.
  echo ERREUR pendant la creation du .exe.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   TERMINE !
echo   Cherchez l'installateur dans le dossier dist

echo ========================================
echo.
pause
