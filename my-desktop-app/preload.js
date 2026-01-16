const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Imprimer un ticket
    printTicket: (text) => ipcRenderer.invoke('print-ticket', text),
    
    // Obtenir la liste des imprimantes disponibles
    getAvailablePrinters: () => ipcRenderer.invoke('get-available-printers')
});