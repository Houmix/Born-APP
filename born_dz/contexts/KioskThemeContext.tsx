// contexts/KioskThemeContext.tsx
// Fournit la personnalisation de la borne (couleurs, logo, vidéo screensaver)

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getPosUrl, getRestaurantId, loadRestaurantId } from '@/utils/serverConfig';
import { addThemeUpdateListener, removeThemeUpdateListener } from '@/utils/syncListeners';

export interface KioskTheme {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    cardBgColor: string;
    textColor: string;
    sidebarColor: string;
    categoryBgColor: string;
    selectedCategoryBgColor: string;
    categoryTextColor: string;
    selectedCategoryTextColor: string;
    sidebarDisplayMode: 'with_image' | 'without_image';
    logoUrl: string | null;
    screensaverImageUrl: string | null;
    screensaverVideoUrl: string | null;
    cardStyle: 'gradient' | 'macdo' | 'magazine';
    compositionMode: 'modal' | 'page';
    loyaltyEnabled: boolean;
    loyaltyPointsRate: number;
    categoryDisplayMode: 'sidebar' | 'grid_macdo';
    tvaRate: number;
    ticketHeader: string;
    ticketFooter: string;
    ticketShowTva: boolean;
    deliveryModes: 'both' | 'sur_place_only' | 'emporter_only';
}

const DEFAULT_THEME: KioskTheme = {
    primaryColor: '#0056b3',
    secondaryColor: '#ff69b4',
    backgroundColor: '#F8F9FA',
    cardBgColor: '#ffffff',
    textColor: '#1e293b',
    sidebarColor: '#1e293b',
    categoryBgColor: '#1e293b',
    selectedCategoryBgColor: '#334155',
    categoryTextColor: '#94a3b8',
    selectedCategoryTextColor: '#ff69b4',
    sidebarDisplayMode: 'with_image',
    logoUrl: null,
    screensaverImageUrl: null,
    screensaverVideoUrl: null,
    cardStyle: 'gradient',
    compositionMode: 'page',
    loyaltyEnabled: false,
    loyaltyPointsRate: 10,
    categoryDisplayMode: 'sidebar',
    tvaRate: 0,
    ticketHeader: '',
    ticketFooter: '',
    ticketShowTva: false,
    deliveryModes: 'both',
};

const THEME_CACHE_KEY = 'kiosk_theme_cache';

const KioskThemeContext = createContext<KioskTheme>(DEFAULT_THEME);

export function KioskThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<KioskTheme>(DEFAULT_THEME);

    const fetchTheme = useCallback(async () => {
        // Essayer en mémoire d'abord, puis AsyncStorage si null
        let restaurantId = getRestaurantId();
        if (!restaurantId) restaurantId = await loadRestaurantId();

        const cacheKey = restaurantId ? `${THEME_CACHE_KEY}_${restaurantId}` : THEME_CACHE_KEY;

        if (!restaurantId) {
            console.warn('[KioskTheme] restaurant_id non disponible, thème par défaut utilisé');
            return;
        }

        try {
            const response = await axios.get(
                `${getPosUrl()}/api/kiosk/config/?restaurant_id=${restaurantId}`,
                { timeout: 5000 }
            );
            const data = response.data;

            // Le backend renvoie déjà une URL absolue (request.build_absolute_uri)
            // → on utilise data.logo_url directement sans re-préfixer
            const newTheme: KioskTheme = {
                primaryColor:       data.primary_color       || DEFAULT_THEME.primaryColor,
                secondaryColor:     data.secondary_color     || DEFAULT_THEME.secondaryColor,
                backgroundColor:    data.background_color    || DEFAULT_THEME.backgroundColor,
                cardBgColor:        data.card_bg_color       || DEFAULT_THEME.cardBgColor,
                textColor:          data.text_color          || DEFAULT_THEME.textColor,
                sidebarColor:              data.sidebar_color               || DEFAULT_THEME.sidebarColor,
                categoryBgColor:           data.category_bg_color           || DEFAULT_THEME.categoryBgColor,
                selectedCategoryBgColor:   data.selected_category_bg_color  || DEFAULT_THEME.selectedCategoryBgColor,
                categoryTextColor:             data.category_text_color              || DEFAULT_THEME.categoryTextColor,
                selectedCategoryTextColor:    data.selected_category_text_color     || DEFAULT_THEME.selectedCategoryTextColor,
                sidebarDisplayMode:           (data.sidebar_display_mode as 'with_image' | 'without_image') || DEFAULT_THEME.sidebarDisplayMode,
                logoUrl:             data.logo_url              || null,
                screensaverImageUrl: data.screensaver_image_url || null,
                screensaverVideoUrl: data.screensaver_video_url || null,
                cardStyle:          (data.card_style as 'gradient' | 'macdo' | 'magazine') || 'gradient',
                compositionMode:    (data.composition_mode as 'modal' | 'page') || 'page',
                loyaltyEnabled:     data.loyalty_enabled ?? false,
                loyaltyPointsRate:  data.loyalty_points_rate ?? 10,
                categoryDisplayMode: (data.category_display_mode as 'sidebar' | 'grid_macdo') || 'sidebar',
                tvaRate:            parseFloat(data.tva_rate) || 0,
                ticketHeader:       data.ticket_header || '',
                ticketFooter:       data.ticket_footer || '',
                ticketShowTva:      data.ticket_show_tva ?? false,
                deliveryModes:      (data.delivery_modes as 'both' | 'sur_place_only' | 'emporter_only') || 'both',
            };
            setTheme(newTheme);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(newTheme));
            console.log('[KioskTheme] ✅ Thème rechargé :', newTheme.primaryColor, newTheme.cardStyle);
        } catch (err: any) {
            console.warn('[KioskTheme] Erreur fetch :', err?.message || err);
        }
    }, []);

    useEffect(() => {
        async function init() {
            const restaurantId = getRestaurantId();
            const cacheKey = restaurantId ? `${THEME_CACHE_KEY}_${restaurantId}` : THEME_CACHE_KEY;

            // 1. Affichage immédiat depuis le cache
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setTheme({ ...DEFAULT_THEME, ...JSON.parse(cached) });
                }
            } catch {}

            // 2. Fetch API pour avoir les données fraîches
            await fetchTheme();
        }

        init();

        // Recharger le thème à chaque retour au premier plan
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') fetchTheme();
        });

        // Recharger immédiatement si le serveur envoie theme_updated via WebSocket
        addThemeUpdateListener(fetchTheme);

        return () => {
            sub.remove();
            removeThemeUpdateListener(fetchTheme);
        };
    }, [fetchTheme]);

    return (
        <KioskThemeContext.Provider value={theme}>
            {children}
        </KioskThemeContext.Provider>
    );
}

export function useKioskTheme(): KioskTheme {
    return useContext(KioskThemeContext);
}
