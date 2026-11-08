@echo off
cd /d "%~dp0"
echo Starting the Stats Viewer mirror (June 12, 2024 snapshot)...
echo It will open at http://localhost:8642/
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8642/"
node server.js