const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const express = require('express');
const { autoUpdater } = require('electron-updater');

// Imprimantes virtuelles à exclure (pas de port physique)
const VIRTUAL_PRINTER_KEYWORDS = ['PDF', 'Fax', 'OneNote', 'XPS', 'Microsoft', 'Send to', 'Cloud'];

let mainWindow;
let localServer = null;

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
// 🖨️ IMPRESSION RAW via PowerShell + winspool.drv
// Fonctionne avec toute imprimante connectée (USB, réseau, COM)
// sans configuration de port manuel.
// ==========================================

/**
 * Génère le script PowerShell qui envoie des octets bruts à une imprimante
 * via l'API Windows winspool.drv (mode RAW, aucun reformatage GDI)
 */
function buildRawPrintScript(filePath, printerName) {
    const safePrinter = printerName.replace(/'/g, "''");
    const safePath = filePath.replace(/\\/g, '\\\\');

    return `
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    public static bool SendBytesToPrinter(string printerName, byte[] data)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA docInfo = new DOCINFOA();
        docInfo.pDocName = "ClickGo Ticket";
        docInfo.pDataType = "RAW";

        bool success = false;

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, ref docInfo))
            {
                if (StartPagePrinter(hPrinter))
                {
                    IntPtr unmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data, 0, unmanagedBytes, data.Length);

                    int bytesWritten;
                    success = WritePrinter(hPrinter, unmanagedBytes, data.Length, out bytesWritten);
                    success = success && (bytesWritten == data.Length);

                    Marshal.FreeCoTaskMem(unmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }

        return success;
    }
}
'@ -ErrorAction SilentlyContinue

$bytes = [System.IO.File]::ReadAllBytes('${safePath}')
$result = [RawPrinterHelper]::SendBytesToPrinter('${safePrinter}', $bytes)
Write-Output $result
`;
}

/**
 * Scanne tous les ports COM disponibles et tente d'envoyer les données ESC/POS
 * (imprimantes série sans pilote Windows)
 */
async function printToComPorts(dataBuffer) {
    let SerialPort;
    try {
        ({ SerialPort } = require('serialport'));
    } catch (e) {
        console.warn('[COM] Module serialport non disponible:', e.message);
        return [];
    }

    let ports = [];
    try {
        ports = await SerialPort.list();
    } catch (e) {
        console.warn('[COM] Impossible de lister les ports COM:', e.message);
        return [];
    }

    if (ports.length === 0) {
        console.log('[COM] Aucun port COM détecté.');
        return [];
    }

    console.log(`[COM] ${ports.length} port(s) COM : ${ports.map(p => p.path).join(', ')}`);

    const BAUD_RATES = [9600, 19200, 38400, 115200];
    const results = [];

    for (const portInfo of ports) {
        const portPath = portInfo.path;
        let sent = false;

        for (const baudRate of BAUD_RATES) {
            if (sent) break;
            try {
                await new Promise((resolve, reject) => {
                    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
                    const timer = setTimeout(() => {
                        try { port.close(); } catch (e) {}
                        reject(new Error('Timeout'));
                    }, 3000);

                    port.open((err) => {
                        if (err) { clearTimeout(timer); return reject(err); }
                        port.write(dataBuffer, (writeErr) => {
                            if (writeErr) {
                                clearTimeout(timer);
                                port.close();
                                return reject(writeErr);
                            }
                            port.drain(() => {
                                clearTimeout(timer);
                                port.close();
                                resolve();
                            });
                        });
                    });
                });
                sent = true;
                console.log(`[COM] OK "${portPath}" @${baudRate}`);
                results.push({ printer: portPath, status: 'success' });
            } catch (e) {
                // essai baud rate suivant
            }
        }

        if (!sent) {
            console.warn(`[COM] ÉCHEC "${portPath}"`);
            results.push({ printer: portPath, status: 'error', error: 'Aucun baud rate accepté' });
        }
    }

    return results;
}

/**
 * Génère les commandes ESC/POS pour imprimer un QR code (modèle 2)
 */
function buildQRCodeCommands(data) {
    if (!data || data.trim().length === 0) return Buffer.alloc(0);
    const dataBytes = Buffer.from(data.trim(), 'utf8');
    const storeLen = dataBytes.length + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;

    return Buffer.concat([
        Buffer.from('\n'),                                                          // ligne vide avant
        Buffer.from([0x1B, 0x61, 0x01]),                                           // alignement centré
        Buffer.from([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),     // modèle 2
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]),           // taille module 6
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]),           // correction M
        Buffer.from([0x1D, 0x28, 0x6B, pL,   pH,   0x31, 0x50, 0x30]),           // stocker données
        dataBytes,
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),           // imprimer QR
        Buffer.from([0x1B, 0x61, 0x00]),                                           // retour alignement gauche
        Buffer.from('\n'),                                                          // ligne vide après
    ]);
}

ipcMain.handle("printTicket", async (event, ticketText, qrContent) => {
    const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);

    try {
        console.log('[Impression] Préparation du ticket...');

        // ── 1. Commandes ESC/POS ──
        const ESC = '\x1B';
        const GS  = '\x1D';

        const INIT          = ESC + '@';                    // Reset imprimante
        const MARGIN_LEFT_0 = GS + 'L' + '\x00' + '\x00'; // Marge gauche = 0
        const ALIGN_LEFT    = ESC + 'a' + '\x00';          // Alignement gauche
        const FONT_NORMAL   = ESC + '!' + '\x00';          // Police normale (Font A)
        const LINE_SPACING  = ESC + '3' + '\x12';          // Interligne serré
        const LINE_FEEDS    = '\n\n\n\n\n';                // Espace avant coupe
        const CUT_COMMAND   = GS + 'V' + '\x42' + '\x00'; // Coupe complète

        // ── 2. Assemblage (ticket + QR code optionnel) en Buffer ──
        const headerBuf = Buffer.from(INIT + MARGIN_LEFT_0 + ALIGN_LEFT + FONT_NORMAL + LINE_SPACING, 'latin1');
        const ticketBuf = Buffer.from(ticketText, 'latin1');
        const qrBuf     = buildQRCodeCommands(qrContent || '');
        const footerBuf = Buffer.from(LINE_FEEDS + CUT_COMMAND, 'latin1');

        const fullContentBuf = Buffer.concat([headerBuf, ticketBuf, qrBuf, footerBuf]);

        // Rétro-compat : la suite du code utilise encore fullContent comme string latin1
        const fullContent = fullContentBuf.toString('latin1');

        // ── 2. Écriture fichier binaire (latin1 préserve les octets ESC/POS) ──
        fs.writeFileSync(tempFilePath, fullContent, { encoding: 'latin1' });

        // ── 3. Récupérer les imprimantes physiques ──
        if (!mainWindow) {
            throw new Error("La fenêtre principale n'est pas active.");
        }

        const allPrinters = await mainWindow.webContents.getPrintersAsync();
        const physicalPrinters = allPrinters.filter(p => {
            const name = p.name.toLowerCase();
            return !VIRTUAL_PRINTER_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
        });

        if (physicalPrinters.length === 0) {
            console.warn('[Impression] Aucune imprimante via spooler → scan ports COM...');
            const dataBuffer = Buffer.from(fullContent, 'latin1');
            const comResults = await printToComPorts(dataBuffer);
            const comSuccess = comResults.some(r => r.status === 'success');
            return { success: comSuccess, details: comResults, error: comSuccess ? undefined : "Aucune imprimante disponible" };
        }

        console.log(`[Impression] ${physicalPrinters.length} imprimante(s) : ${physicalPrinters.map(p => p.name).join(', ')}`);

        // ── 4. Envoi RAW via winspool.drv (PowerShell) — s'arrête dès le premier succès ──
        const results = [];

        for (const printer of physicalPrinters) {
            const printerName = printer.name;
            console.log(`[Impression] --> Envoi vers "${printerName}"...`);

            try {
                const psScript = buildRawPrintScript(tempFilePath, printerName);
                const scriptPath = path.join(os.tmpdir(), `print-script-${Date.now()}.ps1`);
                fs.writeFileSync(scriptPath, psScript, { encoding: 'utf-8' });

                const output = execSync(
                    `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
                    { windowsHide: true, timeout: 10000, encoding: 'utf-8' }
                ).trim();

                try { fs.unlinkSync(scriptPath); } catch (e) {}

                if (output === 'True') {
                    console.log(`[Impression] OK "${printerName}"`);
                    results.push({ printer: printerName, status: 'success' });
                    break; // ✅ Un seul ticket : on s'arrête après le premier succès
                } else {
                    throw new Error(`WritePrinter a retourné: ${output}`);
                }

            } catch (err) {
                console.error(`[Impression] ÉCHEC "${printerName}": ${err.message}`);
                results.push({ printer: printerName, status: 'error', error: err.message });
            }
        }

        // ── 5. Fallback COM si aucun succès via spooler ──
        if (!results.some(r => r.status === 'success')) {
            console.log('[Impression] Spooler sans succès → scan ports COM...');
            const dataBuffer = Buffer.from(fullContent, 'latin1');
            const comResults = await printToComPorts(dataBuffer);
            // Aussi s'arrêter au premier succès COM
            for (const r of comResults) {
                results.push(r);
                if (r.status === 'success') break;
            }
        }

        // ── 6. Nettoyage ──
        setTimeout(() => {
            try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
        }, 2000);

        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`[Impression] Terminé : ${successCount}/${results.length} OK`);

        return { success: successCount > 0, details: results };

    } catch (error) {
        console.error(`[Impression] ERREUR: ${error.message}`);
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
        return { success: false, error: error.message };
    }
});

// ==========================================
// 🔄 MISE À JOUR AUTOMATIQUE
// ==========================================
function setupAutoUpdater() {
    autoUpdater.autoDownload = true;       // Téléchargement silencieux en arrière-plan
    autoUpdater.autoInstallOnAppQuit = true; // Installe à la fermeture

    autoUpdater.on('update-available', (info) => {
        console.log(`[Updater] Nouvelle version disponible : ${info.version}`);
        // Notifier l'interface (optionnel)
        if (mainWindow) {
            mainWindow.webContents.send('update-available', info.version);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log(`[Updater] Version ${info.version} téléchargée.`);
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Mise à jour disponible',
            message: `La version ${info.version} de ClickGo Borne est prête.\nCliquez sur OK pour installer et redémarrer.`,
            buttons: ['Installer maintenant', 'Plus tard'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Erreur mise à jour:', err.message);
    });

    // Vérifier au démarrage (délai de 10s pour laisser l'app s'initialiser)
    setTimeout(() => {
        if (app.isPackaged) autoUpdater.checkForUpdates();
    }, 10000);

    // Revérifier toutes les 4 heures
    setInterval(() => {
        if (app.isPackaged) autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
}

// ==========================================
// 🚀 INITIALISATION
// ==========================================
app.whenReady().then(async () => {
    await createWindow();
    setupAutoUpdater();
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