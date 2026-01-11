@echo off
echo ========================================
echo  Compiling Telegram Signal Mirror EAs
echo ========================================
echo.

REM Try common MT5 installation paths
set "MT5_PATH_1=C:\Program Files\MetaTrader 5\metaeditor64.exe"
set "MT5_PATH_2=C:\Program Files (x86)\MetaTrader 5\metaeditor64.exe"
set "MT5_PATH_3=%APPDATA%\MetaQuotes\Terminal\*\MQL5\metaeditor64.exe"

REM Try common MT4 installation paths
set "MT4_PATH_1=C:\Program Files\MetaTrader 4\metaeditor.exe"
set "MT4_PATH_2=C:\Program Files (x86)\MetaTrader 4\metaeditor.exe"

set "SOURCE_DIR=%~dp0"
set "MQ4_FILE=%SOURCE_DIR%TelegramSignalMirror.mq4"
set "MQ5_FILE=%SOURCE_DIR%TelegramSignalMirror.mq5"

echo Source directory: %SOURCE_DIR%
echo.

REM Compile MT4 EA
echo [1/2] Compiling MT4 EA...
if exist "%MT4_PATH_1%" (
    echo Using: %MT4_PATH_1%
    "%MT4_PATH_1%" /compile:"%MQ4_FILE%" /log
    echo MT4 compilation complete!
) else if exist "%MT4_PATH_2%" (
    echo Using: %MT4_PATH_2%
    "%MT4_PATH_2%" /compile:"%MQ4_FILE%" /log
    echo MT4 compilation complete!
) else (
    echo WARNING: MetaEditor 4 not found in common locations.
    echo Please compile TelegramSignalMirror.mq4 manually in MetaEditor.
)

echo.

REM Compile MT5 EA
echo [2/2] Compiling MT5 EA...
if exist "%MT5_PATH_1%" (
    echo Using: %MT5_PATH_1%
    "%MT5_PATH_1%" /compile:"%MQ5_FILE%" /log
    echo MT5 compilation complete!
) else if exist "%MT5_PATH_2%" (
    echo Using: %MT5_PATH_2%
    "%MT5_PATH_2%" /compile:"%MQ5_FILE%" /log
    echo MT5 compilation complete!
) else (
    echo WARNING: MetaEditor 5 not found in common locations.
    echo Please compile TelegramSignalMirror.mq5 manually in MetaEditor.
)

echo.
echo ========================================
echo  Compilation process finished!
echo ========================================
echo.
echo Check the output above for any errors.
echo If compilation was successful, copy the .ex4/.ex5 files to your MT4/MT5 Experts folder.
echo.
pause
