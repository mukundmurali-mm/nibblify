# Nibblify installer for Windows (PowerShell)
# Usage: irm https://raw.githubusercontent.com/mukundmurali-mm/nibblify/master/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "https://github.com/mukundmurali-mm/nibblify"
$InstallDir = "$HOME\nibblify"

function Write-Info  { param($msg) Write-Host "▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  NIBBLIFY" -ForegroundColor Cyan
Write-Host "  Turn YouTube videos into daily bite-sized episodes"
Write-Host ""

# ── prerequisites ────────────────────────────────────────────────────────────
Write-Info "Checking prerequisites..."

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Fail "Python is required. Install from https://python.org/downloads (tick 'Add Python to PATH')"
}
Write-Ok "Python $(python --version 2>&1)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js is required. Install from https://nodejs.org"
}
Write-Ok "Node $(node --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm is required. Install from https://nodejs.org"
}
Write-Ok "npm $(npm --version)"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Fail "Claude Code CLI is required. Install from https://claude.ai/code"
}
Write-Ok "Claude Code installed"

# ── download ──────────────────────────────────────────────────────────────────
if (Test-Path "$InstallDir\.git") {
    Write-Info "Updating existing installation at $InstallDir..."
    git -C $InstallDir pull --quiet
    Write-Ok "Updated"
} elseif (Test-Path $InstallDir) {
    Write-Fail "$InstallDir already exists but is not a git repo. Remove it and retry."
} else {
    Write-Info "Downloading Nibblify to $InstallDir..."
    if (Get-Command git -ErrorAction SilentlyContinue) {
        git clone --quiet "$Repo.git" $InstallDir
    } else {
        # git not available — fall back to zip download
        $zip = "$env:TEMP\nibblify.zip"
        Invoke-WebRequest -Uri "$Repo/archive/refs/heads/master.zip" -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath "$env:TEMP\nibblify_extract" -Force
        Move-Item "$env:TEMP\nibblify_extract\nibblify-master" $InstallDir
        Remove-Item $zip
    }
    Write-Ok "Downloaded"
}

# ── backend dependencies ──────────────────────────────────────────────────────
Write-Info "Installing backend dependencies..."
Set-Location "$InstallDir\backend"
python -m venv .venv
.venv\Scripts\pip install -q -r requirements.txt
Write-Ok "Backend ready"

# ── frontend dependencies ─────────────────────────────────────────────────────
Write-Info "Installing frontend dependencies..."
Set-Location "$InstallDir\frontend"
npm install --silent
Write-Ok "Frontend ready"

# ── done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Nibblify installed successfully!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the app:"
Write-Host ""
Write-Host "    cd $InstallDir" -ForegroundColor Cyan
Write-Host "    start.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Then open http://localhost:5173 in your browser."
Write-Host ""
