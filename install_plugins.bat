@echo off
title ZKTeco Dashboard - Install Dependencies
color 0A
echo.
echo ============================================================
echo   ZKTeco Attendance Dashboard - Dependency Installer
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo.
    echo Please download and install Python from:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANT: During install, tick "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo [OK] Python found:
python --version
echo.

REM Check Python bitness
echo Checking Python bitness...
python -c "import struct; print('     Python is', struct.calcsize('P')*8, 'bit')"
echo.

REM Upgrade pip silently
echo Upgrading pip...
python -m pip install --upgrade pip --quiet
echo [OK] pip upgraded
echo.

REM Install Python packages
echo Installing Python packages...
echo.

echo   [1/5] Installing flask...
pip install flask --quiet
if %ERRORLEVEL% EQU 0 (echo   [OK] flask installed) else (echo   [FAILED] flask)

echo   [2/5] Installing pyzk...
pip install pyzk --quiet
if %ERRORLEVEL% EQU 0 (echo   [OK] pyzk installed) else (echo   [FAILED] pyzk)

echo   [3/5] Installing pyodbc...
pip install pyodbc --quiet
if %ERRORLEVEL% EQU 0 (echo   [OK] pyodbc installed) else (echo   [FAILED] pyodbc)

echo   [4/5] Installing openpyxl...
pip install openpyxl --quiet
if %ERRORLEVEL% EQU 0 (echo   [OK] openpyxl installed) else (echo   [FAILED] openpyxl)

echo   [5/5] Installing pandas...
pip install pandas --quiet
if %ERRORLEVEL% EQU 0 (echo   [OK] pandas installed) else (echo   [FAILED] pandas)

echo.
echo ============================================================
echo   All Python packages installed!
echo ============================================================
echo.
echo ------------------------------------------------------------
echo   IMPORTANT: Microsoft Access Database Engine
echo ------------------------------------------------------------
echo   You also need to install the Microsoft Access Database
echo   Engine to read .mdb files. It must match your Python
echo   bitness (32-bit or 64-bit).
echo.
echo   Download link:
echo   https://www.microsoft.com/en-us/download/details.aspx?id=54920
echo.
echo   Opening download page now...
start "" "https://www.microsoft.com/en-us/download/details.aspx?id=54920"
echo ------------------------------------------------------------
echo.
echo Once the Access Database Engine is installed,
echo you are ready to use the dashboard!
echo.
echo Double-click OPEN_DASHBOARD.bat to start.
echo.
pause
