@echo off
setlocal enabledelayedexpansion

REM Start and end dates
set "start=2026-01-01"
set "end=2026-12-31"

REM Convert start and end dates to YYYYMMDD format for calculation
for /f "tokens=1-3 delims=-" %%a in ("%start%") do (
    set /a "sYear=%%a"
    set /a "sMonth=%%b"
    set /a "sDay=%%c"
)

for /f "tokens=1-3 delims=-" %%a in ("%end%") do (
    set /a "eYear=%%a"
    set /a "eMonth=%%b"
    set /a "eDay=%%c"
)

REM Loop through dates
set "current=!sYear!-!sMonth!-!sDay!"
:loop
if "!current!" GTR "%end%" goto :end

REM Create folder
mkdir "!current!" 2>nul

REM Increment date by 1 day using PowerShell
for /f %%i in ('powershell -command "(Get-Date '!current!').AddDays(1).ToString('yyyy-MM-dd')"') do set "current=%%i"

goto loop

:end
echo All folders created.
pause
