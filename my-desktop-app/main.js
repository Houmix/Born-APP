const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

let mainWindow;

// Configuration de l'imprimante
const PORT_COM = "COM5";      // ✅ Ton port validé
const BAUD_RATE = 115200;     // ✅ Ta vitesse validée

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1080,
        height: 1920,
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL('http://localhost:8081'); 
}

// ==========================================
// 🖨️ HANDLER D'IMPRESSION SÉRIE (CORRIGÉ)
// ==========================================
ipcMain.handle("printTicket", async (event, ticketContent) => {
    const tempFilePath = path.join(os.tmpdir(), `ticket_${Date.now()}.txt`);
    
    try {
        console.log(`[Impression] Début sur ${PORT_COM}...`);
        
        // Commandes ESC/POS : Sauts de ligne + Découpe
        const ESC = '\x1B';
        const GS = '\x1D';
        const CUT_COMMAND = '\n\n\n\n' + GS + 'V' + '\x00';  // ✅ Commande de coupe standard
        
        const fullContent = ticketContent + CUT_COMMAND;
        
        // ✅ CORRECTION 1 : Écriture en UTF-8 (pas latin1 pour éviter les problèmes)
        fs.writeFileSync(tempFilePath, fullContent, { encoding: 'utf8' });
        console.log(`[Impression] Fichier créé: ${tempFilePath}`);
        
        // ✅ CORRECTION 2 : Configuration du port COM (syntaxe corrigée)
        try {
            const modeCommand = `mode ${PORT_COM}: BAUD=${BAUD_RATE} PARITY=N DATA=8 STOP=1`;
            console.log(`[Impression] Configuration port: ${modeCommand}`);
            execSync(modeCommand, { windowsHide: true });
            console.log(`[Impression] ✅ Port ${PORT_COM} configuré`);
        } catch (modeError) {
            // Si le port est déjà configuré, on continue
            console.log(`[Impression] ⚠️ Port déjà configuré ou erreur mode: ${modeError.message}`);
        }
        
        // ✅ CORRECTION 3 : Envoi vers COM (syntaxe corrigée avec guillemets)
        const printCommand = `type "${tempFilePath}" > ${PORT_COM}`;
        console.log(`[Impression] Commande: ${printCommand}`);
        
        execSync(printCommand, { 
            windowsHide: true,
            shell: 'cmd.exe',
            timeout: 5000
        });
        
        console.log(`[Impression] ✅ Données envoyées à ${PORT_COM}`);
        
        return { success: true, port: PORT_COM };
        
    } catch (error) {
        console.error(`[Impression] ❌ Erreur: ${error.message}`);
        console.error(`[Impression] ❌ Stack: ${error.stack}`);
        
        return { 
            success: false, 
            error: error.message,
            details: `Échec d'impression sur ${PORT_COM}. Vérifiez que le port est disponible.`
        };
        
    } finally {
        // Nettoyage du fichier temporaire
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[Impression] Fichier temporaire supprimé`);
            }
        } catch (cleanupError) {
            console.error(`[Impression] ⚠️ Erreur nettoyage: ${cleanupError.message}`);
        }
    }
});

// ==========================================
// 🔧 HANDLER: Tester le port COM
// ==========================================
ipcMain.handle("testPort", async () => {
    try {
        console.log(`[Test] Vérification de ${PORT_COM}...`);
        
        // Tester la configuration du port
        const modeCommand = `mode ${PORT_COM}:`;
        const result = execSync(modeCommand, { 
            encoding: 'utf8',
            windowsHide: true 
        });
        
        console.log(`[Test] ✅ Port ${PORT_COM} accessible`);
        console.log(result);
        
        return { 
            success: true, 
            port: PORT_COM,
            info: result
        };
        
    } catch (error) {
        console.error(`[Test] ❌ Port ${PORT_COM} inaccessible: ${error.message}`);
        
        return { 
            success: false, 
            error: error.message,
            help: `Vérifiez que l'imprimante est branchée et que le pilote est installé.`
        };
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
