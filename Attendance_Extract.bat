@echo off
setlocal

:: Set the source file name (change this to your file)
set "source=Attendance_Extract.exe"

:: Set the target root folder (same folder where this .bat file is)
set "target_root=%~dp0"

:: Loop through all subfolders
for /d %%a in ("%target_root%\*") do (
    echo Copying "%source%" to "%%a"...
    copy "%target_root%%source%" "%%a\" /Y >nul
)

echo Done!
pause
