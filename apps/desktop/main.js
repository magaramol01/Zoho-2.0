const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
let waitOn;
try {
  waitOn = require('wait-on');
} catch (e) {
  // wait-on is a dev dependency, not needed in production
}

const isDev = !app.isPackaged;
const WEB_PORT = 3000;
const API_PORT = 3001;

let webProcess = null;
let apiProcess = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../web/public/logo.svg'),
    title: 'Zoho Sprints Power Grid',
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
}

app.whenReady().then(() => {
  if (isDev) {
    // In development, assume the user ran 'pnpm dev' which started Next.js on 3000
    const opts = { resources: [`http://localhost:${WEB_PORT}`], timeout: 30000 };
    waitOn(opts)
      .then(() => createWindow())
      .catch((err) => console.error('Timeout waiting for Next.js server.', err));
  } else {
    // In production, spawn the bundled NestJS backend and Next.js standalone server
    const apiPath = path.join(__dirname, '../api/dist/apps/api/src/main.js');
    const webPath = path.join(__dirname, '../web/.next/standalone/apps/web/server.js');

    // Make sure we pass the correct port to Next.js standalone
    const env = { ...process.env, PORT: WEB_PORT, NODE_ENV: 'production' };

    apiProcess = spawn(process.execPath, [apiPath], { env });
    webProcess = spawn(process.execPath, [webPath], { env });

    // Give the local servers a moment to bind to ports before opening the window
    setTimeout(() => {
      createWindow();
    }, 2000);
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
