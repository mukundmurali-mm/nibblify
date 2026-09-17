// Nibblify — Electron main process.
// Spawns the FastAPI backend (which also serves the built frontend),
// waits for it to become healthy, then opens the window.

const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let backendProcess = null;
let mainWindow = null;

// --------- Path resolution (dev vs packaged) ---------

function resolvePaths() {
  const isPackaged = app.isPackaged;
  // In a packaged .app, extraResources land in process.resourcesPath.
  // In dev, everything lives at the repo root.
  const base = isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  return {
    isPackaged,
    backendDir: path.join(base, 'backend'),
    frontendDist: path.join(base, 'frontend', 'dist'),
  };
}

// --------- Locate a usable Python interpreter ---------

function findPython(backendDir) {
  // 1. Bundled venv (created by `npm run setup:backend` before packaging)
  const venvPy = path.join(backendDir, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPy)) return venvPy;

  // 2. User-writable venv inside ~/Library/Application Support/Nibblify (created on first run)
  const userVenv = path.join(app.getPath('userData'), 'venv', 'bin', 'python3');
  if (fs.existsSync(userVenv)) return userVenv;

  return null;
}

// --------- Create a per-user venv on first launch, if needed ---------

function ensureUserVenv(backendDir) {
  return new Promise((resolve, reject) => {
    const userVenvDir = path.join(app.getPath('userData'), 'venv');
    const userPy = path.join(userVenvDir, 'bin', 'python3');
    if (fs.existsSync(userPy)) return resolve(userPy);

    // Need system python3 to bootstrap.
    const sysPython = process.env.NIBBLIFY_PYTHON || 'python3';

    const requirements = path.join(backendDir, 'requirements.txt');
    if (!fs.existsSync(requirements)) {
      return reject(new Error(`requirements.txt not found at ${requirements}`));
    }

    console.log(`[nibblify] creating venv at ${userVenvDir} using ${sysPython}`);
    const mk = spawn(sysPython, ['-m', 'venv', userVenvDir], { stdio: 'inherit' });
    mk.on('error', reject);
    mk.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`python -m venv failed (exit ${code}). Is Python 3.11+ installed?`));
      const pip = path.join(userVenvDir, 'bin', 'pip');
      console.log('[nibblify] installing backend dependencies...');
      const inst = spawn(pip, ['install', '-q', '-r', requirements], { stdio: 'inherit' });
      inst.on('error', reject);
      inst.on('exit', (c2) => {
        if (c2 !== 0) return reject(new Error(`pip install failed (exit ${c2}).`));
        resolve(userPy);
      });
    });
  });
}

// --------- Start uvicorn ---------

function startBackend(pythonPath, backendDir, frontendDist) {
  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'learner.db');
  try { fs.mkdirSync(userData, { recursive: true }); } catch (_) {}

  const env = {
    ...process.env,
    NIBBLIFY_FRONTEND_DIST: frontendDist,
    NIBBLIFY_DB_PATH: dbPath,
    NIBBLIFY_CONFIG_DIR: userData,
    // Make sure the packaged app can find /usr/local/bin (claude, brew python, etc.)
    PATH: [
      process.env.PATH || '',
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      path.join(os.homedir(), '.local', 'bin'),
    ].filter(Boolean).join(':'),
  };

  console.log(`[nibblify] starting backend: ${pythonPath} -m uvicorn main:app --port ${BACKEND_PORT}`);
  const proc = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
    { cwd: backendDir, env, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let recentStderr = '';
  proc.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  proc.stderr.on('data', (d) => {
    const s = d.toString();
    process.stderr.write(`[backend] ${s}`);
    recentStderr = (recentStderr + s).slice(-2000);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[nibblify] backend exited (code=${code} signal=${signal})`);
    const wasRunning = backendProcess === proc;
    backendProcess = null;
    // If the backend dies while the window is still open, tell the user
    // instead of leaving them with a mysterious "Failed to fetch".
    if (wasRunning && !app.isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      const hint = (recentStderr.match(/address already in use|Errno 48|EADDRINUSE/i))
        ? '\n\nPort 8000 is already in use. Another Nibblify (or uvicorn) process is probably still running. Quit it and reopen Nibblify.'
        : '';
      dialog.showErrorBox(
        'Nibblify — Backend stopped',
        `The backend process exited unexpectedly (code=${code} signal=${signal}). The app will now close.${hint}\n\nLast backend output:\n${recentStderr.slice(-800) || '(none)'}`
      );
      app.quit();
    }
  });

  return proc;
}

// --------- Wait until /api/health responds ---------

function waitForBackend(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`${BACKEND_URL}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1500, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Backend did not become ready in time.'));
      setTimeout(tryOnce, 400);
    };
    tryOnce();
  });
}

// --------- Window ---------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Nibblify',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the user's browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BACKEND_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(BACKEND_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --------- Lifecycle ---------

async function boot() {
  const { backendDir, frontendDist } = resolvePaths();

  if (!fs.existsSync(backendDir)) {
    dialog.showErrorBox('Nibblify', `Backend directory missing: ${backendDir}`);
    app.quit();
    return;
  }

  let pythonPath = findPython(backendDir);
  if (!pythonPath) {
    try {
      pythonPath = await ensureUserVenv(backendDir);
    } catch (err) {
      dialog.showErrorBox(
        'Nibblify — Python setup failed',
        `${err.message}\n\nInstall Python 3.11+ from https://python.org and relaunch Nibblify.`
      );
      app.quit();
      return;
    }
  }

  backendProcess = startBackend(pythonPath, backendDir, frontendDist);

  try {
    await waitForBackend();
  } catch (err) {
    dialog.showErrorBox('Nibblify — Backend failed to start', err.message);
    app.quit();
    return;
  }

  createWindow();
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => { app.isQuitting = true; });

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try { backendProcess.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        try { backendProcess.kill('SIGKILL'); } catch (_) {}
      }
    }, 2000);
  }
}

app.on('before-quit', stopBackend);
app.on('quit', stopBackend);
process.on('exit', stopBackend);
