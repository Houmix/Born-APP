/**
 * utils/serverMonitor.ts
 * Surveillance continue du serveur caisse :
 *  - Ping toutes les PING_INTERVAL ms
 *  - Si N échecs consécutifs → rescan réseau (l'IP a peut-être changé)
 *  - Quand le serveur revient → traitement de la file de commandes
 *  - Émet des événements via listeners (status, serverUrl)
 */
import {
    getPosUrl,
    saveServerUrl,
    testServerUrl,
    scanNetwork,
    loadRestaurantId,
} from './serverConfig';
import { processQueue } from './orderQueue';

const PING_INTERVAL_MS      = 15_000;  // ping toutes les 15 s
const FAIL_THRESHOLD        = 3;       // N échecs avant rescan
const RESCAN_COOLDOWN_MS    = 60_000;  // ne rescan pas plus d'une fois par minute

export type ServerStatus = 'online' | 'offline' | 'reconnecting';

type StatusListener = (status: ServerStatus, url: string) => void;

let _status: ServerStatus = 'online';
let _failCount            = 0;
let _lastRescan           = 0;
let _timer: ReturnType<typeof setInterval> | null = null;
let _listeners: StatusListener[] = [];
let _started = false;

export function getServerStatus(): ServerStatus {
    return _status;
}

export function addStatusListener(cb: StatusListener) {
    _listeners.push(cb);
}

export function removeStatusListener(cb: StatusListener) {
    _listeners = _listeners.filter(l => l !== cb);
}

function emit(status: ServerStatus) {
    _status = status;
    const url = getPosUrl();
    _listeners.forEach(l => {
        try { l(status, url); } catch {}
    });
}

async function ping(): Promise<void> {
    const currentUrl = getPosUrl();
    const ok = await testServerUrl(currentUrl);

    if (ok) {
        if (_status !== 'online') {
            console.log('[ServerMonitor] ✅ Serveur de retour :', currentUrl);
            emit('online');
            // Traiter les commandes en attente
            processQueue(currentUrl).catch(() => {});
        }
        _failCount = 0;
        return;
    }

    _failCount++;
    console.log(`[ServerMonitor] ❌ Ping échoué (${_failCount}/${FAIL_THRESHOLD}) — ${currentUrl}`);

    if (_failCount >= FAIL_THRESHOLD) {
        if (_status !== 'offline' && _status !== 'reconnecting') {
            emit('offline');
        }

        // Re-scan réseau si le cooldown est passé
        const now = Date.now();
        if (now - _lastRescan > RESCAN_COOLDOWN_MS) {
            _lastRescan = now;
            emit('reconnecting');
            console.log('[ServerMonitor] 🔍 Rescan réseau en cours...');

            try {
                const found = await scanNetwork();
                if (found) {
                    console.log('[ServerMonitor] 🆕 Nouveau serveur trouvé :', found.url);
                    await saveServerUrl(found.url);
                    _failCount = 0;
                    emit('online');
                    // Traiter la file maintenant que l'URL est à jour
                    processQueue(found.url).catch(() => {});
                } else {
                    console.log('[ServerMonitor] Aucun serveur trouvé sur le réseau');
                    emit('offline');
                }
            } catch (e) {
                console.error('[ServerMonitor] Erreur rescan :', e);
                emit('offline');
            }
        }
    } else {
        // Pas encore au seuil → offline soft
        if (_status !== 'offline' && _status !== 'reconnecting') {
            emit('offline');
        }
    }
}

export function startServerMonitor() {
    if (_started) return;
    _started = true;
    console.log('[ServerMonitor] Démarrage — intervalle', PING_INTERVAL_MS, 'ms');
    // Premier ping immédiat
    ping();
    _timer = setInterval(ping, PING_INTERVAL_MS);
}

export function stopServerMonitor() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    _started = false;
}
