// contexts/KioskThemeContext.tsx
// Fournit la personnalisation de la borne (couleurs, logo, vidéo screensaver)
// Fetché depuis l'API au démarrage, avec fallback sur les valeurs par défaut.

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getPosUrl } from '@/utils/serverConfig';
import { idRestaurant } from '@/config';

export interface KioskTheme {
    primaryColor: string;
    secondaryColor: string;
    sidebarColor: string;
    logoUrl: string | null;
    screensaverVideoUrl: string | null;
}

const DEFAULT_THEME: KioskTheme = {
    primaryColor: '#0056b3',
    secondaryColor: '#ff69b4',
    sidebarColor: '#1e293b',
    logoUrl: null,
    screensaverVideoUrl: null,
};

const THEME_CACHE_KEY = 'kiosk_theme_cache';

const KioskThemeContext = createContext<KioskTheme>(DEFAULT_THEME);

export function KioskThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<KioskTheme>(DEFAULT_THEME);

    useEffect(() => {
        async function loadTheme() {
            // 1. Chargement depuis le cache pour affichage immédiat
            try {
                const cached = await AsyncStorage.getItem(THEME_CACHE_KEY);
                if (cached) {
                    setTheme({ ...DEFAULT_THEME, ...JSON.parse(cached) });
                }
            } catch {}

            // 2. Récupération depuis le serveur
            try {
                const response = await axios.get(
                    `${getPosUrl()}/api/kiosk/config/?restaurant_id=${idRestaurant}`,
                    { timeout: 5000 }
                );
                const data = response.data;
                const serverUrl = getPosUrl();
                const newTheme: KioskTheme = {
                    primaryColor: data.primary_color || DEFAULT_THEME.primaryColor,
                    secondaryColor: data.secondary_color || DEFAULT_THEME.secondaryColor,
                    sidebarColor: data.sidebar_color || DEFAULT_THEME.sidebarColor,
                    logoUrl: data.logo_url ? `${serverUrl}${data.logo_url}` : null,
                    screensaverVideoUrl: data.screensaver_video_url
                        ? `${serverUrl}${data.screensaver_video_url}`
                        : null,
                };
                setTheme(newTheme);
                await AsyncStorage.setItem(THEME_CACHE_KEY, JSON.stringify(newTheme));
            } catch {
                // Endpoint non disponible ou réseau hors ligne : on garde les valeurs en cache/défaut
            }
        }
        loadTheme();
    }, []);

    return (
        <KioskThemeContext.Provider value={theme}>
            {children}
        </KioskThemeContext.Provider>
    );
}

export function useKioskTheme(): KioskTheme {
    return useContext(KioskThemeContext);
}
