const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { SerialPort } = require('serialport');
const express = require('express');

// ==========================================
// ⚙️ CONFIGURATION (S = Spooler / C = COM)
// ==========================================
const ACTIVE_PROFILE = 'C'; 
const PRINTERS = {
    S: { port: "COM4", baud: 115200, driver: 'Samsung' },
    C: { port: "COM4", baud: 9600,   driver: 'Cashino' }
};

const CURRENT_CONFIG = PRINTERS[ACTIVE_PROFILE];
const POS_PRINTER_NAME = "PrinterC"; // Nom pour le profil 'S'
let mainWindow;
let cashinoPort = null;

const isDev = !app.isPackaged;

// ==========================================
// 🖥️ FENÊTRE & SERVEUR STATIQUE
// ==========================================
function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        kiosk: true, // Mode borne
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:8081'); // URL Expo Dev
    } else {
        // En prod, on lance un mini serveur Express pour le web-build
        const server = express();
        const webBuildPath = path.join(process.resourcesPath, 'web-build');
        
        server.use(express.static(webBuildPath));
        server.get('*', (req, res) => res.sendFile(path.join(webBuildPath, 'index.html')));
        
        server.listen(8081, '127.0.0.1', () => {
            mainWindow.loadURL('http://127.0.0.1:8081');
        });
    }
}

// ==========================================
// 🖨️ LOGIQUE D'IMPRESSION (PROFIL S)
// ==========================================
function printSamsung(ticketText) {
    const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);
    const ESC = '\x1B';
    const GS = '\x1D';
    const cutCommand = '\n\n\n\n' + GS + 'V' + '\x00';
    const fullTicket = ticketText + cutCommand;

    fs.writeFileSync(tempFilePath, fullTicket, { encoding: 'latin1' });

    try {
        // Tentative RAW via partage
        const printerPath = `\\\\127.0.0.1\\${POS_PRINTER_NAME}`;
        execSync(`cmd /c "type ${tempFilePath} > ${printerPath}"`, { windowsHide: true });
    } catch (e) {
        // Repli PowerShell
        execSync(`powershell -Command "Get-Content '${tempFilePath}' | Out-Printer -Name '${POS_PRINTER_NAME}'"`, { windowsHide: true });
    }
}

// ==========================================
// 🖨️ LOGIQUE D'IMPRESSION (PROFIL C)
// ==========================================
function connectCashino() {
    cashinoPort = new SerialPort({
        path: CURRENT_CONFIG.port,
        baudRate: CURRENT_CONFIG.baud,
        autoOpen: true
    });
}

function printCashino(ticketText) {
    return new Promise((resolve) => {
        const GS = '\x1D';
        const cutCommand = '\n\n\n\n' + GS + 'V' + '\x00';
        const fullData = Buffer.from(ticketText + cutCommand, 'latin1');
        
        cashinoPort.write(fullData, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true });
        });
    });
}

// ==========================================
// 🛰️ IPC HANDLER
// ==========================================
ipcMain.handle("print-ticket", async (event, ticketText) => {
    if (ACTIVE_PROFILE === 'S') {
        printSamsung(ticketText);
        return { success: true };
    } else {
        return await printCashino(ticketText);
    }
});

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (ACTIVE_PROFILE === 'C') connectCashino();
    createWindow();
});

app.on('window-all-closed', () => app.quit());