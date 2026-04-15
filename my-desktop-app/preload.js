const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Cette fonction sera appelée dans ton fichier confirmation.tsx
    printTicket: (content, qrContent) => ipcRenderer.invoke('printTicket', content, qrContent),
});