@echo off
title ZKTeco Attendance Dashboard
echo.
echo ================================================
echo   Starting Attendance Dashboard...
echo ================================================
echo.

pip install flask --quiet 2>nul

echo Starting server...
start "" http://localhost:5000
python "%~dp0server.py"

pause
