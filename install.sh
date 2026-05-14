#!/bin/bash
set -e

REPO="https://github.com/mukundmurali-mm/nibblify"
INSTALL_DIR="$HOME/nibblify"

# ── colours ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; RESET='\033[0m'
info()  { echo -e "${BLUE}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✓ $*${RESET}"; }
fail()  { echo -e "${RED}✗ $*${RESET}"; exit 1; }

echo ""
echo -e "${BLUE}  ███╗   ██╗██╗██████╗ ██████╗ ██╗     ██╗███████╗██╗   ██╗${RESET}"
echo -e "${BLUE}  ████╗  ██║██║██╔══██╗██╔══██╗██║     ██║██╔════╝╚██╗ ██╔╝${RESET}"
echo -e "${BLUE}  ██╔██╗ ██║██║██████╔╝██████╔╝██║     ██║█████╗   ╚████╔╝ ${RESET}"
echo -e "${BLUE}  ██║╚██╗██║██║██╔══██╗██╔══██╗██║     ██║██╔══╝    ╚██╔╝  ${RESET}"
echo -e "${BLUE}  ██║ ╚████║██║██████╔╝██████╔╝███████╗██║██║        ██║   ${RESET}"
echo -e "${BLUE}  ╚═╝  ╚═══╝╚═╝╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═╝        ╚═╝  ${RESET}"
echo ""
echo "  Turn YouTube videos into daily bite-sized episodes"
echo ""

# ── prerequisites ───────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 \
  || fail "Python 3 is required. Install from https://python.org/downloads"
ok "Python $(python3 --version | cut -d' ' -f2)"

command -v node >/dev/null 2>&1 \
  || fail "Node.js is required. Install from https://nodejs.org"
ok "Node $(node --version)"

command -v npm >/dev/null 2>&1 \
  || fail "npm is required. Install from https://nodejs.org"
ok "npm $(npm --version)"

command -v claude >/dev/null 2>&1 \
  || fail "Claude Code CLI is required. Install from https://claude.ai/code"
ok "Claude Code $(claude --version | head -1)"

# ── download ────────────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation at $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --quiet
  ok "Updated"
else
  if [ -d "$INSTALL_DIR" ]; then
    fail "$INSTALL_DIR already exists but is not a git repo. Remove it and retry."
  fi
  info "Downloading Nibblify to $INSTALL_DIR..."
  if command -v git >/dev/null 2>&1; then
    git clone --quiet "$REPO.git" "$INSTALL_DIR"
  else
    # git not available — fall back to tarball
    mkdir -p "$INSTALL_DIR"
    curl -fsSL "$REPO/archive/refs/heads/master.tar.gz" \
      | tar -xz -C "$INSTALL_DIR" --strip-components=1
  fi
  ok "Downloaded"
fi

# ── backend dependencies ────────────────────────────────────────────────────
info "Installing backend dependencies..."
cd "$INSTALL_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
ok "Backend ready"

# ── frontend dependencies ───────────────────────────────────────────────────
info "Installing frontend dependencies..."
cd "$INSTALL_DIR/frontend"
npm install --silent
ok "Frontend ready"

# ── done ────────────────────────────────────────────────────────────────────
chmod +x "$INSTALL_DIR/start.sh"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}  Nibblify installed successfully!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  Start the app:"
echo ""
echo -e "    ${BLUE}cd $INSTALL_DIR && ./start.sh${RESET}"
echo ""
echo "  Then open http://localhost:5173 in your browser."
echo ""
