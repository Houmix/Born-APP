// contexts/BorneSyncProvider.tsx
// WebSocket persistant — actif dès le démarrage de la borne, quelle que soit l'écran affiché.
// Reçoit les notifications du serveur et dispatch aux listeners enregistrés.

import React, { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPosUrl, getRestaurantId } from '@/utils/serverConfig';
import {
    themeUpdateListeners,
    menuRefreshListeners,
    STEPS_INVALIDATION_FLAG,
} from '@/utils/syncListeners';

// ID unique de la borne (stocké en AsyncStorage)
async function getBorneId(): Promise<string> {
    let id = await AsyncStorage.getItem('borne_id').catch(() => null);
    if (!id) {
        id = `BORNE_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await AsyncStorage.setItem('borne_id', id).catch(() => {});
    }
    return id;
}

export function BorneSyncProvider({ children }: { children: React.ReactNode }) {
    const ws    = useRef<WebSocket | null>(null);
    const wsCtl = useRef<WebSocket | null>(null);
    const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectTimerCtl = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const connectControl = async () => {
        const url = getPosUrl();
        if (!url) return;
        const borneId = await getBorneId();
        const resId   = getRestaurantId();
        const wsUrl   = `${url.replace(/^http/, 'ws')}/ws/borne/control/?borne_id=${borneId}&restaurant_id=${resId}`;

        if (wsCtl.current && wsCtl.current.readyState === WebSocket.OPEN) return;
        const socket = new WebSocket(wsUrl);
        wsCtl.current = socket;

        socket.onmessage = async (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type !== 'borne_command') return;
                const { command } = msg;

                if (command === 'update_images' || command === 'update_all') {
                    await AsyncStorage.setItem(STEPS_INVALIDATION_FLAG, 'true');
                    menuRefreshListeners.forEach(cb => { try { cb(); } catch {} });
                    themeUpdateListeners.forEach(cb => { try { cb(); } catch {} });
                } else if (command === 'reboot') {
                    // Sur Android, on ne peut pas redémarrer directement — on alerte
                    Alert.alert('Redémarrage', 'Veuillez relancer l\'application manuellement.');
                } else if (command === 'disable') {
                    await AsyncStorage.setItem('borne_disabled', 'true');
                    Alert.alert('Borne désactivée', 'Cette borne a été désactivée par l\'administrateur.');
                } else if (command === 'enable') {
                    await AsyncStorage.removeItem('borne_disabled');
                }
            } catch {}
        };
        socket.onclose = () => {
            if (reconnectTimerCtl.current) clearTimeout(reconnectTimerCtl.current);
            reconnectTimerCtl.current = setTimeout(connectControl, 10000);
        };
        socket.onerror = () => socket.close();
    };

    useEffect(() => {
        connect();
        connectControl();

        // Reconnexion quand l'app revient au premier plan
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') {
                if (!ws.current || ws.current.readyState !== WebSocket.OPEN) connect();
                if (!wsCtl.current || wsCtl.current.readyState !== WebSocket.OPEN) connectControl();
            }
        });

        // Rafraîchissement du thème toutes les 5 min (fallback si WS injoignable)
        const themeInterval = setInterval(() => {
            themeUpdateListeners.forEach(cb => { try { cb(); } catch {} });
        }, 5 * 60 * 1000);

        // Rafraîchissement des menus/options toutes les 5 min (synchronise images, étapes, prix)
        const menuInterval = setInterval(() => {
            menuRefreshListeners.forEach(cb => { try { cb(); } catch {} });
        }, 5 * 60 * 1000);

        return () => {
            sub.remove();
            clearInterval(themeInterval);
            clearInterval(menuInterval);
            if (reconnectTimer.current)    clearTimeout(reconnectTimer.current);
            if (reconnectTimerCtl.current) clearTimeout(reconnectTimerCtl.current);
            ws.current?.close();
            wsCtl.current?.close();
        };
    }, []);

    return <>{children}</>;
}
