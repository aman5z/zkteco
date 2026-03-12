@echo off
title ZKTeco - Today's Attendance Report
echo.
echo ================================================
echo   Generating TODAY's Attendance Report...
echo ================================================
echo.

python "%~dp0attendance_tool.py" today

echo.
if %ERRORLEVEL% EQU 0 (
    echo Report generated successfully!
    echo Opening report...
    start "" "%~dp0today_report.xlsx"
) else (
    echo Something went wrong. Check the error above.
)

echo.
pause
