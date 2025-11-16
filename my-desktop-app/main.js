const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');

let expoProcess;
let staticServer;
let mainWindow;
let splashWindow;

// 🔹 Détection mode dev/prod
const isDev = !app.isPackaged;

// 🔹 Logs
function log(message, type = 'info') {
  const emoji = { info: '🔹', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
  console.log(`${emoji} ${message}`);
}

// 🔹 Chemins
function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  if (process.platform === 'darwin') {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

const frontendPath = getResourcePath('born_dz');
const webBuildPath = path.join(frontendPath, 'web-build');

log(`Mode: ${isDev ? 'DEV' : 'PROD'}`, 'info');
log(`Frontend Path: ${frontendPath}`, 'info');

// 🔹 Vérifications
function checkRequirements() {
  if (!isDev && !fs.existsSync(webBuildPath)) {
    log('ERREUR: web-build manquant !', 'error');
    log('Build le frontend: cd born_dz && npx expo export --platform web --output-dir web-build', 'error');
    app.quit();
    return false;
  }
  
  if (isDev && !fs.existsSync(webBuildPath)) {
    log('web-build manquant, Expo dev server sera utilisé (plus lent)', 'warning');
  }
  
  return true;
}

// 🔹 Serveur statique Express (PRODUCTION)
function startStaticServer(callback) {
  log('Démarrage serveur frontend statique...', 'info');
  
  const expressApp = express();
  
  // Servir les fichiers statiques
  expressApp.use(express.static(webBuildPath));
  
  // SPA fallback - CRUCIAL pour le routing React/Expo Router
  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(webBuildPath, 'index.html'));
  });
  
  staticServer = expressApp.listen(8081, '127.0.0.1', (err) => {
    if (err) {
      log(`Erreur serveur: ${err.message}`, 'error');
      app.quit();
      return;
    }
    log('Frontend prêt sur http://127.0.0.1:8081', 'success');
    callback();
  });
}

// 🔹 Expo Dev Server (DEV)
function startExpo(callback) {
  log('Démarrage Expo web (dev)...', 'warning');
  
  expoProcess = spawn('npx', ['expo', 'start', '--web', '--port', '8081', '--non-interactive', '--host', '127.0.0.1'], {
    cwd: frontendPath,
    shell: true,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'pipe'
  });

  expoProcess.stdout.on('data', (data) => {
    const dataStr = data.toString().trim();
    if (dataStr.includes('http://127.0.0.1:8081') || dataStr.includes('Listening on')) {
       console.log(`[Expo] ${dataStr}`);
    }
  });

  expoProcess.stderr.on('data', (data) => {
    console.error(`[Expo] ${data.toString().trim()}`);
  });

  expoProcess.on('error', (err) => {
    log(`Erreur Expo (spawn): ${err.message}`, 'error');
    app.quit();
  });

  waitForServer('http://127.0.0.1:8081', 90, 2000, () => {
    log('Expo prêt', 'success');
    callback();
  });
}

// 🔹 Attente serveur
function waitForServer(url, retries = 30, interval = 2000, callback) {
  let attempts = 0;
  
  const check = () => {
    http.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 510) { 
        callback();
      } else {
        retry();
      }
    }).on('error', retry);
  };
  
  const retry = () => {
    attempts++;
    if (attempts < retries) {
      log(`Attente de ${url} (${attempts}/${retries})...`, 'info');
      setTimeout(check, interval);
    } else {
      log(`Timeout: ${url} non accessible après ${retries} tentatives`, 'error');
      if (splashWindow) {
        splashWindow.close();
      }
      app.quit();
    }
  };
  
  check();
}

// 🔹 Créer la fenêtre principale
function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    log('Application prête', 'success');
  });

  // 🔥 CRUCIAL : loadURL au lieu de loadFile pour que le routing fonctionne
  mainWindow.loadURL('http://127.0.0.1:8081'); 

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 🔹 Créer la fenêtre d'attente (Splash Screen)
function createSplashWindow(callback) {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html')); 
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    callback();
  });
}

// 🔹 Nettoyage
function cleanup() {
  log('Arrêt des processus...', 'info');
  
  if (expoProcess && !expoProcess.killed) {
    expoProcess.kill('SIGTERM');
  }
  
  if (staticServer) {
    staticServer.close(() => log('Serveur statique arrêté', 'info'));
  }
}

// 🔹 Démarrage
app.whenReady().then(() => {
  if (!checkRequirements()) return;
  
  createSplashWindow(() => {
    if (fs.existsSync(webBuildPath)) {
      startStaticServer(createMainWindow);
    } else if (isDev) {
      startExpo(createMainWindow);
    } else {
      log('Pas de frontend disponible en prod !', 'error');
      if (splashWindow) {
        splashWindow.close();
      }
      app.quit();
    }
  });
});

// 🔹 Fermeture
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);

process.on('uncaughtException', (error) => {
  log(`Erreur non gérée: ${error.message}`, 'error');
  console.error(error.stack);
  cleanup();
  app.quit();
});
