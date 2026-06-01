const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const WEB_PORT = 4000;
const API_PORT = 4001;

let webProcess = null;
let apiProcess = null;

// Set human-readable app name for Linux desktop environments (fixes dock/launcher showing package.json name)
if (process.platform === 'linux') {
  app.name = 'Zoho Power Grid';
}

// ── Single-instance lock ──────────────────────────────────────────────────────
// Prevents a fork-bomb when the AppImage is launched multiple times quickly.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[desktop] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
}

// If a second instance tries to open, focus the existing window instead.
app.on('second-instance', () => {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    const win = wins[0];
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// ── Built-in server readiness poll (replaces wait-on devDependency) ───────────
function waitForServer(url, timeoutMs = 60000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume(); // discard body
        resolve();
      });
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(check, intervalMs);
        }
      });
      req.setTimeout(intervalMs, () => {
        req.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(check, intervalMs);
        }
      });
    };
    check();
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Zoho Sprints Power Grid',
    backgroundColor: '#0f0f1a',
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
}

app.whenReady().then(async () => {
  if (isDev) {
    // Development: assume 'pnpm dev' already started Next.js on port 3000
    waitForServer(`http://localhost:${WEB_PORT}`, 60000)
      .then(() => createWindow())
      .catch(() => createWindow()); // open anyway after timeout
  } else {
    // Production: spawn the bundled NestJS backend + Next.js standalone server
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
    const fs = require('fs');
    const os = require('os');

    // ── Parse bundled .env file ───────────────────────────────────────────────
    const envFilePath = path.join(resourcesPath, 'api/.env');
    let bundledEnv = {};
    try {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        bundledEnv[key] = val;
      }
      console.log('[desktop] Loaded .env from:', envFilePath);
    } catch (e) {
      console.warn('[desktop] Could not read .env file:', e.message);
    }

    // ── Writable user data dir for SQLite DB ─────────────────────────────────
    const userDataDir = path.join(os.homedir(), '.local', 'share', 'zoho-power-grid');
    fs.mkdirSync(userDataDir, { recursive: true });
    const sqliteDbPath = path.join(userDataDir, 'zoho-power-grid.db');

    const apiPath = path.join(resourcesPath, 'api/dist/apps/api/src/main.js');
    const webPath = path.join(resourcesPath, 'web/_modules/next/dist/bin/next');

    const env = {
      ...process.env,
      ...bundledEnv,          // Merge all .env vars (includes APP_ENCRYPTION_KEY etc.)
      PORT: String(WEB_PORT),
      API_PORT: String(API_PORT),
      NODE_ENV: 'production',
      SQLITE_DB_PATH: sqliteDbPath,   // Always write to user's home (AppImage is read-only)
      NEXT_SHARP_PATH: path.join(resourcesPath, 'web/_modules/sharp'),
      // NODE_PATH allows Node.js to find deps in _modules (renamed from node_modules
      // to bypass electron-builder's module pruning on extraResources)
      NODE_PATH: `${path.join(resourcesPath, 'api/_modules')}:${path.join(resourcesPath, 'web/_modules')}`,
    };

    console.log('[desktop] Starting API from:', apiPath);
    console.log('[desktop] Starting Web from:', webPath);
    console.log('[desktop] SQLite DB path:', sqliteDbPath);

    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as a plain Node.js
    // process so the spawned API/Web servers don't trigger the single-instance lock
    const baseSpawnEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' };
    
    const apiSpawnEnv = { ...baseSpawnEnv, PORT: String(API_PORT) };
    const webSpawnEnv = { ...baseSpawnEnv, PORT: String(WEB_PORT) };

    apiProcess = spawn(process.execPath, [apiPath], { env: apiSpawnEnv, stdio: 'inherit' });
    
    // For Web, we use `next start` which takes the directory as an argument
    const webDir = path.join(resourcesPath, 'web');
    webProcess = spawn(process.execPath, [webPath, 'start', webDir], { env: webSpawnEnv, stdio: 'inherit' });

    apiProcess.on('error', (err) => console.error('[api] spawn error:', err));
    webProcess.on('error', (err) => console.error('[web] spawn error:', err));

    // Wait for both servers before showing the window
    try {
      await Promise.all([
        waitForServer(`http://localhost:${WEB_PORT}`, 60000),
        waitForServer(`http://localhost:${API_PORT}`, 60000),
      ]);
    } catch (err) {
      console.warn('[desktop] Timed out waiting for servers, opening anyway.', err.message);
    }

    createWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (webProcess) webProcess.kill();
  if (apiProcess) apiProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (webProcess) webProcess.kill();
  if (apiProcess) apiProcess.kill();
});
