const escpos = require('escpos');
// On charge l'adaptateur Série au lieu de USB
escpos.Serial = require('escpos-serialport');

function printTicket(ticketContent, ticketFormat = 'TEXT') {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[PRINT] Tentative d'impression sur COM4...`);

      // 1. CONFIGURATION COM4
      // baudRate: Souvent 9600 pour les vieilles imprimantes, ou 115200 pour les récentes.
      // Si ça imprime des caractères bizarres, essaie de changer 9600 en 115200.
      const device = new escpos.Serial('COM4', {
        baudRate: 9600, 
        autoOpen: false 
      });

      const options = { encoding: "858" }; // Encodage Euro + Accents
      const printer = new escpos.Printer(device, options);

      device.open(function(error) {
        if (error) {
          console.error("[PRINT] Erreur ouverture port:", error);
          return reject(error);
        }

        console.log("[PRINT] Port COM4 ouvert. Envoi des données...");

        try {
          printer
            .font('a')
            .align('lt')
            .style('normal')
            .size(0, 0);

          // Gestion du contenu
          if (ticketFormat === 'JSON') {
            // ... (ton code JSON existant si besoin) ...
             printer.text(JSON.stringify(ticketContent));
          } else {
            // Mode TEXTE BRUT (celui que tu utilises)
            printer.text(ticketContent);
          }

          printer
            .feed(2)
            .cut()
            .close(function(err) {
                if (err) {
                    console.error("[PRINT] Erreur fermeture:", err);
                    reject(err);
                } else {
                    console.log("[PRINT] Impression terminée et port fermé.");
                    resolve("Impression terminée");
                }
            });

        } catch (printError) {
          console.error("[PRINT] Erreur pendant l'envoi:", printError);
          device.close();
          reject(printError);
        }
      });

    } catch (e) {
      console.error("[PRINT] Exception critique:", e);
      reject(e);
    }
  });
}

module.exports = { printTicket };