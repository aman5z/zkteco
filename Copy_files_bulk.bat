@echo off
REM === Folder containing all subfolders ===
set "targetFolder=C:\Users\namee\OneDrive - PACE GROUP DMCC\Desktop\Attendance\NEXT_MONTHS\"

REM === List of files to copy ===
set "file1=C:\Users\namee\OneDrive - PACE GROUP DMCC\Desktop\Attendance\NEXT_MONTHS\Attendance_Extract.exe"
set "file2=C:\Users\namee\OneDrive - PACE GROUP DMCC\Desktop\Attendance\NEXT_MONTHS\Attendance_Extract.bat"
set "file3=C:\Users\namee\OneDrive - PACE GROUP DMCC\Desktop\Attendance\NEXT_MONTHS\Copy_files_bulk.bat"

REM === Loop through all subfolders ===
for /d %%F in ("%targetFolder%\*") do (
    if exist "%%F" (
        copy /y "%file1%" "%%F\" >nul
        copy /y "%file2%" "%%F\" >nul
        copy /y "%file3%" "%%F\" >nul
    )
)

echo All files copied to all folders successfully.
pause
