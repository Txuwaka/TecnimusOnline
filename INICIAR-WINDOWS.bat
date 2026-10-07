@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 o superior. Descargalo de https://nodejs.org/
  pause
  exit /b 1
)
start "Tecnimus" cmd /k node server\index.cjs
echo Abre http://localhost:3000 en tu navegador.
start "" http://localhost:3000
