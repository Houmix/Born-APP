const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { SerialPort } = require('serialport');
const express = require('express');

// ==========================================
// ⚙️ CONFIGURATION GLOBALE (CHANGE ICI !)
// ==========================================
// 'S' = Samsung (Méthode CMD/Fichier)
// 'C' = Cashino (Méthode SerialPort/Flux continu)
const ACTIVE_PROFILE = 'C'; 

const PRINTERS = {
    S: { port: "COM4", baud: 115200, driver: 'Samsung' },
    C: { port: "COM4", baud: 9600,   driver: 'Cashino' }
};

const CURRENT_CONFIG = PRINTERS[ACTIVE_PROFILE];
let mainWindow;
let cashinoPort = null; // Connexion persistante pour Cashino
let localServer = null; // Serveur HTTP local

// ==========================================
// 🌐 SERVEUR HTTP LOCAL (pour les chemins absolus Expo)
// ==========================================
function startLocalServer(webBuildPath) {
    return new Promise((resolve) => {
        const app = express();
        const PORT = 8765;

        // Servir les fichiers statiques
        app.use(express.static(webBuildPath));

        // Rediriger toutes les routes vers index.html (pour React Router)
        app.get('*', (req, res) => {
            res.sendFile(path.join(webBuildPath, 'index.html'));
        });

        localServer = app.listen(PORT, () => {
            console.log(`✅ Serveur local démarré sur http://localhost:${PORT}`);
            resolve(`http://localhost:${PORT}`);
        });
    });
}

// ==========================================
// 🖥️ FENÊTRE PRINCIPALE
// ==========================================
async function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        kiosk: true,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    
    if (app.isPackaged) {
        // EN PRODUCTION : Serveur local pour gérer les chemins absolus
        const webBuildPath = path.join(process.resourcesPath, 'web-build');
        
        if (fs.existsSync(webBuildPath)) {
            console.log("📁 Démarrage du serveur local pour web-build...");
            const url = await startLocalServer(webBuildPath);
            mainWindow.loadURL(url);
        } else {
            console.error("❌ Dossier web-build introuvable:", webBuildPath);
        }
        
    } else {
        // EN DÉVELOPPEMENT : Serveur Expo
        mainWindow.loadURL('http://localhost:8001');
    }
}

// ==========================================
// 🚀 ROUTEUR D'IMPRESSION
// ==========================================
ipcMain.handle("printTicket", async (event, ticketContent) => {
    console.log(`\n🖨️ DEMANDE IMPRESSION - PROFIL: [${ACTIVE_PROFILE}] ${CURRENT_CONFIG.driver}`);

    if (ACTIVE_PROFILE === 'S') {
        return await printSamsung(ticketContent);
    } else if (ACTIVE_PROFILE === 'C') {
        return await printCashino(ticketContent);
    }
});

// ==========================================
// 🛠️ DRIVER A : SAMSUNG (Méthode Shell/CMD)
// ==========================================
async function printSamsung(ticketContent) {
    const tempFilePath = path.join(os.tmpdir(), `ticket_${Date.now()}.txt`);
    const { port, baud } = CURRENT_CONFIG;

    try {
        // 1. Préparation du contenu (UTF-8 pour Samsung)
        const GS = '\x1D';
        const CUT_COMMAND = '\n\n\n\n' + GS + 'V' + '\x00';
        const fullContent = ticketContent + CUT_COMMAND;
        
        fs.writeFileSync(tempFilePath, fullContent, { encoding: 'utf8' });

        // 2. Configuration du port via CMD
        try {
            execSync(`mode ${port}: BAUD=${baud} PARITY=N DATA=8 STOP=1`, { windowsHide: true });
        } catch (e) { /* Ignorer si déjà configuré */ }

        // 3. Envoi via CMD
        execSync(`type "${tempFilePath}" > ${port}`, { 
            windowsHide: true, 
            shell: 'cmd.exe', 
            timeout: 5000 
        });

        console.log(`✅ [Samsung] Envoyé sur ${port}`);
        return { success: true };

    } catch (error) {
        console.error(`❌ [Samsung] Erreur: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
}

// ==========================================
// 🛠️ DRIVER B : CASHINO (Méthode SerialPort Persistante)
// ==========================================

// 1. Gestion de la connexion (Appelée au démarrage)
function connectCashino() {
    if (cashinoPort && cashinoPort.isOpen) return;
    const { port, baud } = CURRENT_CONFIG;

    console.log(`🔌 [Cashino] Connexion persistante au ${port}...`);
    cashinoPort = new SerialPort({
        path: port,
        baudRate: baud,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false,
        rtscts: false
    });

    cashinoPort.open((err) => {
        if (err) {
            console.error(`❌ [Cashino] Échec connexion: ${err.message}`);
            setTimeout(connectCashino, 5000); // Retry auto
        } else {
            console.log(`✅ [Cashino] Connecté sur ${port}`);
        }
    });

    cashinoPort.on('close', () => {
        console.warn("⚠️ [Cashino] Déconnecté ! Tentative de reconnexion...");
        cashinoPort = null;
        setTimeout(connectCashino, 5000);
    });
    
    cashinoPort.on('error', (err) => console.error(`❌ [Cashino] Erreur Port: ${err.message}`));
}

// 2. Logique d'envoi par paquets (Chunking)
async function printCashino(ticketContent) {
    if (!cashinoPort || !cashinoPort.isOpen) {
        connectCashino();
        return { success: false, error: "Imprimante déconnectée, réessayez dans 5s..." };
    }

    return new Promise((resolve) => {
        // Préparation Buffer (Latin1 pour Cashino)
        const ESC = 0x1B;
        const GS = 0x1D;
        const header = Buffer.from([ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01]); 
        
        // Nettoyage texte
        const cleanContent = ticketContent.replace(/\r\n/g, '\n').replace(/\n/g, '\n');
        const content = Buffer.from(cleanContent + '\n\n', 'latin1'); 
        const footer = Buffer.from([0x0A, 0x0A, 0x0A, 0x0A, GS, 0x56, 0x42, 0x00]);

        const fullData = Buffer.concat([header, content, footer]);

        // Envoi lent (16 bytes par 50ms)
        const CHUNK_SIZE = 16; 
        let currentOffset = 0;

        function sendNextChunk() {
            if (currentOffset >= fullData.length) {
                cashinoPort.drain(() => {
                    console.log("✅ [Cashino] Impression terminée (Buffer vidé)");
                    resolve({ success: true });
                });
                return;
            }

            const end = Math.min(currentOffset + CHUNK_SIZE, fullData.length);
            const chunk = fullData.slice(currentOffset, end);

            cashinoPort.write(chunk, (err) => {
                if (err) {
                    console.error("❌ [Cashino] Erreur écriture:", err);
                    resolve({ success: false, error: err.message });
                    if (cashinoPort.isOpen) cashinoPort.close();
                    return;
                }
                currentOffset += CHUNK_SIZE;
                setTimeout(sendNextChunk, 50); // Pause moteur
            });
        }
        sendNextChunk();
    });
}

// ==========================================
// 🚀 INITIALISATION
// ==========================================
app.whenReady().then(async () => {
    await createWindow();
    
    // On lance la connexion persistante SEULEMENT si on est en mode Cashino
    if (ACTIVE_PROFILE === 'C') {
        connectCashino();
    }
});

app.on('window-all-closed', () => {
    // Fermer le serveur local
    if (localServer) {
        localServer.close();
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});