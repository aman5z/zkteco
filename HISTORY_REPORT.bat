@echo off
title ZKTeco - History Report from MDB Backup
echo.
echo ================================================
echo   History Attendance Report
echo ================================================
echo.
echo   Enter date range (format: DD/MM/YYYY)
echo.
set /p START_DATE="  Start date: "
set /p END_DATE="  End date:   "
echo.
echo   Generating report from %START_DATE% to %END_DATE% ...
echo.

python "%~dp0attendance_tool.py" history "%~dp0your_backup.mdb" "%START_DATE%" "%END_DATE%"

echo.
if %ERRORLEVEL% EQU 0 (
    echo Report generated successfully!
    echo Opening report...
    start "" "%~dp0history_report.xlsx"
) else (
    echo Something went wrong. Check the error above.
)

echo.
pause
