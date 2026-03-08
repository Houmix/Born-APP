// contexts/BorneSyncProvider.tsx
// WebSocket persistant — actif dès le démarrage de la borne, quelle que soit l'écran affiché.
// Reçoit les notifications du serveur et dispatch aux listeners enregistrés.

import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPosUrl } from '@/utils/serverConfig';
import {
    themeUpdateListeners,
    menuRefreshListeners,
    STEPS_INVALIDATION_FLAG,
} from '@/utils/syncListeners';

export function BorneSyncProvider({ children }: { children: React.ReactNode }) {
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMessage = async (raw: string) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type !== 'sync_message') return;
            const status = msg.data?.status;

            if (status === 'theme_updated') {
                console.log('[BorneSync] 🎨 Thème mis à jour — rechargement');
                themeUpdateListeners.forEach(cb => { try { cb(); } catch {} });
            }

            if (status === 'full_sync_required') {
                console.log('[BorneSync] 🔄 Sync complète demandée');
                await AsyncStorage.setItem(STEPS_INVALIDATION_FLAG, 'true');
                // Rafraîchir aussi le thème (menu admin peut modifier le thème en même temps)
                themeUpdateListeners.forEach(cb => { try { cb(); } catch {} });
                // Rafraîchir les menus si terminal.tsx est actif
                menuRefreshListeners.forEach(cb => { try { cb(); } catch {} });
            }
        } catch (e) {
            console.error('[BorneSync] Erreur traitement message WS:', e);
        }
    };

    const connect = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

        const url = getPosUrl();
        if (!url) return;

        const wsUrl = `${url.replace(/^http/, 'ws')}/ws/borne/sync/`;
        console.log('[BorneSync] Connexion WS:', wsUrl);
        const socket = new WebSocket(wsUrl);
        ws.current = socket;

        socket.onopen = () => console.log('[BorneSync] ✅ WebSocket connecté');
        socket.onmessage = (e) => handleMessage(e.data);
        socket.onclose = () => {
            console.log('[BorneSync] WebSocket fermé, reconnexion dans 5s...');
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            reconnectTimer.current = setTimeout(connect, 5000);
        };
        socket.onerror = () => socket.close();
    };

    useEffect(() => {
        connect();

        // Reconnexion quand l'app revient au premier plan
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') {
                if (!ws.current || ws.current.readyState !== WebSocket.OPEN) connect();
            }
        });

        // Rafraîchissement du thème toutes les 5 min (fallback si WS injoignable)
        const themeInterval = setInterval(() => {
            themeUpdateListeners.forEach(cb => { try { cb(); } catch {} });
        }, 5 * 60 * 1000);

        return () => {
            sub.remove();
            clearInterval(themeInterval);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            ws.current?.close();
        };
    }, []);

    return <>{children}</>;
}
