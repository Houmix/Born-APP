const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Cette fonction sera appelée dans ton fichier confirmation.tsx
    printTicket: (content) => ipcRenderer.invoke('printTicket', content),
});