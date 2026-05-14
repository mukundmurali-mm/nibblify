@echo off
setlocal

echo Starting Nibblify...

cd /d "%~dp0backend"

where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: 'claude' CLI not found in PATH. Install Claude Code first.
    exit /b 1
)

if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
    .venv\Scripts\pip install -q -r requirements.txt
)

start "Nibblify Backend" /b .venv\Scripts\uvicorn main:app --reload --port 8000

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
)

start "Nibblify Frontend" /b npm run dev

echo.
echo Nibblify is running!
echo Open http://localhost:5173 in your browser.
echo Close this window or press Ctrl+C to stop.

pause
