const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const os = require('os');

// 🚨 CORRECTION CRUCIALE POUR WINDOWS (Installeurs Squirrel/NSIS)
const electronSquirrelStartup = require('electron-squirrel-startup');
if (electronSquirrelStartup) {
  return app.quit(); 
}

let djangoProcess;
let staticServer;
let mainWindow;
let splashWindow; 
let serialPort = null; // Port série pour l'imprimante

const isDev = !app.isPackaged;

function log(message, type = 'info') {
  const emoji = { info: '🔹', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
  console.log(`${emoji} ${message}`);
}

// ==========================================
// 🖨️ CONFIGURATION IMPRIMANTE SÉRIE
// ==========================================
const PRINTER_PORT = "COM4";        // ⬅️ Port série Windows
const PRINTER_BAUDRATE = 115200;    // ⬅️ Vitesse de communication

// Importer SerialPort (installation requise: npm install serialport)
let SerialPort;
try {
  SerialPort = require('serialport').SerialPort;
  log(`Module SerialPort chargé`, 'success');
} catch (err) {
  log(`⚠️ Module SerialPort non trouvé. Installez-le avec: npm install serialport`, 'warning');
}

// ==========================================
// 🖨️ HANDLER D'IMPRESSION VIA PORT SÉRIE
// ==========================================
ipcMain.handle("print-ticket", async (event, ticketText) => {
    if (!SerialPort) {
        return {
            success: false,
            error: "Module serialport non installé. Exécutez: npm install serialport"
        };
    }

    try {
        log(`[Impression] Tentative sur port série ${PRINTER_PORT}`, 'info');

        // Créer une nouvelle connexion série
        const printer = new SerialPort({
            path: PRINTER_PORT,
            baudRate: PRINTER_BAUDRATE,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            autoOpen: false
        });

        // Ouvrir la connexion
        await new Promise((resolve, reject) => {
            printer.open((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        log(`[Impression] Port ${PRINTER_PORT} ouvert`, 'success');

        // Envoyer le texte à l'imprimante
        await new Promise((resolve, reject) => {
            printer.write(ticketText, 'utf8', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        log(`[Impression] Données envoyées (${ticketText.length} octets)`, 'info');

        // Envoyer des sauts de ligne et la commande de coupe
        await new Promise((resolve, reject) => {
            printer.write('\n\n\n', 'utf8', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Commande ESC/POS pour couper le papier
        const cutCommand = Buffer.from([0x1D, 0x56, 0x00]);
        await new Promise((resolve, reject) => {
            printer.write(cutCommand, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        log(`[Impression] Commande de coupe envoyée`, 'info');

        // Fermer la connexion
        await new Promise((resolve) => {
            printer.close(() => resolve());
        });

        log(`[Impression] ✅ Impression réussie`, 'success');

        return { 
            success: true, 
            port: PRINTER_PORT,
            baudrate: PRINTER_BAUDRATE
        };

    } catch (error) {
        log(`[Impression] ❌ Erreur: ${error.message}`, 'error');
        
        return { 
            success: false, 
            error: error.message,
            port: PRINTER_PORT,
            help: `Vérifiez que l'imprimante est connectée sur ${PRINTER_PORT} et allumée`
        };
    }
});

// ==========================================
// 🖨️ HANDLER: Lister les ports série disponibles
// ==========================================
ipcMain.handle("get-available-ports", async () => {
    if (!SerialPort) {
        return {
            success: false,
            error: "Module serialport non installé"
        };
    }

    try {
        const { SerialPort } = require('serialport');
        const ports = await SerialPort.list();
        
        log(`[Ports] ${ports.length} port(s) série trouvé(s)`, 'success');
        
        const portsList = ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Inconnu',
            serialNumber: port.serialNumber || 'N/A',
            vendorId: port.vendorId || 'N/A',
            productId: port.productId || 'N/A'
        }));

        return { 
            success: true, 
            ports: portsList,
            currentPort: PRINTER_PORT
        };
    } catch (error) {
        log(`[Ports] Erreur: ${error.message}`, 'error');
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// ==========================================
// 🖨️ HANDLER: Tester la connexion au port série
// ==========================================
ipcMain.handle("test-printer-connection", async () => {
    if (!SerialPort) {
        return {
            success: false,
            error: "Module serialport non installé"
        };
    }

    try {
        log(`[Test] Vérification de ${PRINTER_PORT}...`, 'info');

        const printer = new SerialPort({
            path: PRINTER_PORT,
            baudRate: PRINTER_BAUDRATE,
            autoOpen: false
        });

        await new Promise((resolve, reject) => {
            printer.open((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        log(`[Test] ✅ Connexion réussie à ${PRINTER_PORT}`, 'success');

        await new Promise((resolve) => {
            printer.close(() => resolve());
        });

        return {
            success: true,
            port: PRINTER_PORT,
            baudrate: PRINTER_BAUDRATE,
            message: "Connexion réussie"
        };

    } catch (error) {
        log(`[Test] ❌ Échec: ${error.message}`, 'error');
        return {
            success: false,
            port: PRINTER_PORT,
            error: error.message
        };
    }
});

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (name.toLowerCase().startsWith('eth') || 
                    name.toLowerCase().startsWith('en') || 
                    name.toLowerCase().startsWith('wi')) {
                    return iface.address;
                }
                return iface.address; 
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIpAddress();
log(`Adresse IP locale: ${localIp}`, 'info');

function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  if (process.platform === 'darwin') {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

const backendPath = getResourcePath('born_dz');
const frontendPath = getResourcePath('pos');
const webBuildPath = path.join(frontendPath, 'web-build');

function getDjangoExecutable() {
  const managePyPath = path.join(backendPath, 'manage.py');
  const asgiApplication = 'born_dz.asgi:application';
  
  if (isDev) {
    const venvPython = path.join(backendPath, 'venv', 'bin', 'python3');
    const venvPythonWin = path.join(backendPath, 'venv', 'Scripts', 'python.exe');
    const venvDaphne = path.join(backendPath, 'venv', 'bin', 'daphne');
    const venvDaphneWin = path.join(backendPath, 'venv', 'Scripts', 'daphne.exe');
    
    if (fs.existsSync(venvDaphne)) {
      return { exec: venvDaphne, args: [asgiApplication] };
    } else if (fs.existsSync(venvDaphneWin)) {
      return { exec: venvDaphneWin, args: [asgiApplication] };
    } else if (fs.existsSync(venvPython) || fs.existsSync(venvPythonWin)) {
      log('⚠️ Daphne non trouvé, fallback manage.py', 'warning');
      const pythonExec = fs.existsSync(venvPython) ? venvPython : venvPythonWin;
      return { exec: pythonExec, args: [managePyPath] };
    }
    
    log('❌ Python/Daphne introuvable', 'error');
    app.quit();
    return null;

  } else {
    const executableName = process.platform === 'win32' ? 'django_asgi_app.exe' : 'django_asgi_app';
    const bundledExec = path.join(backendPath, executableName); 
    
    if (!fs.existsSync(bundledExec)) {
        log(`❌ Exécutable ASGI manquant: ${bundledExec}`, 'error');
        app.quit();
        return null;
    }
    return { exec: bundledExec, args: [asgiApplication] };
  }
}

const djangoExecInfo = getDjangoExecutable();

log(`Mode: ${isDev ? 'DEV' : 'PROD'}`, 'info');
log(`Backend: ${backendPath}`, 'info');
log(`Frontend: ${frontendPath}`, 'info');
log(`Imprimante: Port série ${PRINTER_PORT} @ ${PRINTER_BAUDRATE} bauds`, 'info');

function checkRequirements() {
  if (!djangoExecInfo) return false;
  
  if (!isDev && !fs.existsSync(webBuildPath)) {
    log('ERREUR: web-build manquant !', 'error');
    app.quit();
    return false;
  }
  
  if (isDev && !fs.existsSync(webBuildPath)) {
    log('web-build manquant, Expo sera utilisé', 'warning');
  }
  
  return true;
}

function startDjango(callback) {
  if (!djangoExecInfo) return;

  log('Vérification et nettoyage du port 8000...', 'info');

  const { exec } = require('child_process');

  const proceedWithStart = () => {
    log('Démarrage Django (ASGI/Daphne)...', 'info');

    const daphneArgs = ['--bind', '0.0.0.0', '--port', '8000'];
    const execPath = djangoExecInfo.exec;
    const args = [...djangoExecInfo.args, ...daphneArgs];

    log(`Commande exécutée: ${execPath} ${args.join(' ')}`, 'info');

    djangoProcess = spawn(execPath, args, {
      cwd: backendPath,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        DJANGO_SETTINGS_MODULE: 'born_dz.settings'
      }
    });

    djangoProcess.stdout.on('data', (data) => {
      const dataStr = data.toString().trim();
      if (dataStr.includes('Starting server') || dataStr.includes('Listening on')) {
        console.log(`[Daphne] ${dataStr}`);
      }
    });

    djangoProcess.stderr.on('data', (data) => {
      console.error(`[Django] ${data.toString().trim()}`);
    });

    djangoProcess.on('error', (err) => {
      log(`Erreur Django (spawn): ${err.message}`, 'error');
      app.quit();
    });

    djangoProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        log(`Django arrêté de manière inattendue (code ${code})`, 'error');
      }
    });

    waitForServer('http://127.0.0.1:8000/admin/', 30, 2000, () => {
      log('Django (ASGI) prêt', 'success');
      log(`URL du serveur pour les clients distants : http://${localIp}:8000`, 'info');
      callback();
    });
  };

  if (process.platform === 'win32') {
    exec('taskkill /f /im daphne.exe /t', () => {
      setTimeout(proceedWithStart, 500);
    });
  } else {
    proceedWithStart();
  }
}

function startStaticServer(callback) {
  log('Démarrage serveur statique...', 'info');
  
  const app = express();
  
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  
  app.use(express.static(webBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(webBuildPath, 'index.html'));
  });
  
  staticServer = app.listen(8081, '127.0.0.1', (err) => {
    if (err) {
      log(`Erreur serveur: ${err.message}`, 'error');
      app.quit();
      return;
    }
    log('Frontend prêt sur http://127.0.0.1:8081', 'success');
    callback();
  });
}

function startExpo(callback) {
  log('Démarrage Expo (dev)...', 'warning');
  
  const expoProcess = spawn('npx', ['expo', 'start', '--web', '--port', '8081'], {
    cwd: frontendPath,
    shell: true,
    env: { 
      ...process.env, 
      BROWSER: 'none',
      CI: '1',
    },
    stdio: 'pipe'
  });

  expoProcess.stdout.on('data', (data) => {
    const dataStr = data.toString().trim();
    if (dataStr.includes('http://127.0.0.1:8081')) {
       console.log(`[Expo] ${dataStr}`);
    }
  });

  expoProcess.stderr.on('data', (data) => {
    console.error(`[Expo] ${data.toString().trim()}`);
  });

  expoProcess.on('error', (err) => {
    log(`Erreur Expo: ${err.message}`, 'error');
    app.quit();
  });

  waitForServer('http://127.0.0.1:8081', 90, 2000, () => {
    log('Expo prêt', 'success');
    callback();
  });
}

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
      log(`Attente ${url} (${attempts}/${retries})...`, 'info');
      setTimeout(check, interval);
    } else {
      log(`Timeout: ${url}`, 'error');
      if (splashWindow) splashWindow.close();
      app.quit();
    }
  };
  
  check();
}

function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
  });
  mainWindow.maximize();
  mainWindow.once('ready-to-show', async () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    
    // 🖨️ Vérifier les ports série disponibles
    if (SerialPort) {
      try {
        const { SerialPort: SP } = require('serialport');
        const ports = await SP.list();
        console.log('\n🔌 === PORTS SÉRIE DISPONIBLES ===');
        ports.forEach((port, i) => {
          console.log(`[${i+1}] ${port.path}`);
          console.log(`    └─ ${port.manufacturer || 'Inconnu'}`);
          if (port.path === PRINTER_PORT) {
            console.log('    ✅ PORT IMPRIMANTE TROUVÉ !');
          }
        });
        console.log('===================================\n');
      } catch (err) {
        console.error('❌ Erreur récupération ports:', err);
      }
    }
    
    log('Application prête', 'success');
  });

  mainWindow.loadURL('http://127.0.0.1:8081'); 

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

const { exec } = require('child_process');

function cleanup() {
  log('Arrêt des processus et libération des ports...', 'info');

  // Fermer le port série si ouvert
  if (serialPort && serialPort.isOpen) {
    serialPort.close(() => {
      log('✅ Port série fermé', 'success');
    });
  }

  if (djangoProcess) {
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${djangoProcess.pid} /f /t`, (err) => {
        if (err) {
          log(`Note: Impossible de tuer le PID ${djangoProcess.pid} (déjà fermé ?)`, 'info');
        } else {
          log('✅ Django et ses processus enfants ont été terminés.', 'success');
        }
      });
    } else {
      djangoProcess.kill('SIGTERM');
    }
  }

  if (staticServer) {
    staticServer.close(() => log('✅ Serveur statique arrêté', 'success'));
  }
}

app.whenReady().then(async () => {
  if (!checkRequirements()) return;

  createSplashWindow(() => {
    startDjango(() => {
      if (fs.existsSync(webBuildPath)) {
        startStaticServer(() => createMainWindow());
      } else if (isDev) {
        startExpo(() => createMainWindow());
      } else {
        log('Pas de frontend en prod !', 'error');
        if (splashWindow) splashWindow.close();
        app.quit();
      }
    });
  });
});

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);

process.on('uncaughtException', (error) => {
  log(`Erreur: ${error.message}`, 'error');
  console.error(error.stack);
  cleanup();
  app.quit();
});