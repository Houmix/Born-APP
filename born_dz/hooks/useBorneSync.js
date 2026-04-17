import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';
import { getPosUrl, getRestaurantId, loadRestaurantId } from '@/utils/serverConfig';
import {
    addMenuRefreshListener,
    removeMenuRefreshListener,
    STEPS_INVALIDATION_FLAG,
} from '@/utils/syncListeners';

const GROUP_MENU_KEY = 'GroupMenu';
const MENU_KEY = 'Menu';

// Récupère (ou rafraîchit) le token anonyme de la borne
async function getOrRefreshToken() {
    const existing = await AsyncStorage.getItem('token');
    if (existing) return existing;

    try {
        const resp = await axios.post(`${getPosUrl()}/user/api/user/token/0`, {}, { timeout: 5000 });
        const token = resp.data.access;
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('Employee_id', '0');
        return token;
    } catch (e) {
        console.error('[SYNC] Impossible d\'obtenir le token anonyme:', e.message);
        return null;
    }
}

export function useBorneSync() {
    const [categories, setCategories] = useState([]);
    const [menus, setMenus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState(null);

    // --- 1. CHARGEMENT DES DONNÉES ---
    const fetchAndCacheAllData = useCallback(async (forceClean = false) => {
        setIsLoading(true);
        try {
            // Si forceClean (commande admin "Mettre à jour tout"), vider tout le cache d'abord
            if (forceClean) {
                console.log('[SYNC] 🗑️ Nettoyage du cache avant rechargement...');
                await AsyncStorage.removeItem(GROUP_MENU_KEY);
                await AsyncStorage.removeItem(MENU_KEY);
                // Invalider aussi le cache des étapes
                await AsyncStorage.setItem(STEPS_INVALIDATION_FLAG, 'true');
                // Supprimer tous les caches d'étapes individuelles
                const allKeys = await AsyncStorage.getAllKeys();
                const stepsKeys = allKeys.filter(k => k.startsWith('@steps_menu_'));
                if (stepsKeys.length > 0) await AsyncStorage.multiRemove(stepsKeys);
            }

            // Essayer en mémoire d'abord, puis AsyncStorage si null
            let currentRestaurantId = getRestaurantId();
            if (!currentRestaurantId) currentRestaurantId = await loadRestaurantId();
            if (!currentRestaurantId) {
                console.error('[SYNC] Restaurant ID manquant');
                return;
            }

            const accessToken = await getOrRefreshToken();
            if (!accessToken) return;

            setRestaurantId(currentRestaurantId);
            const headers = { Authorization: `Bearer ${accessToken}` };

            const [catResp, menuResp] = await Promise.all([
                axios.get(`${getPosUrl()}/menu/api/getGroupMenuList/${currentRestaurantId}/`, { headers, timeout: 10000 }),
                axios.get(`${getPosUrl()}/menu/api/getAllMenu/${currentRestaurantId}/`, { headers, timeout: 10000 }),
            ]);

            const availableCategories = catResp.data.filter(c => c.avalaible);
            setCategories(availableCategories);
            setMenus(menuResp.data);

            await AsyncStorage.setItem(GROUP_MENU_KEY, JSON.stringify(availableCategories));
            await AsyncStorage.setItem(MENU_KEY, JSON.stringify(menuResp.data));

            console.log('[SYNC] ✅ Données rechargées depuis le serveur');
        } catch (error) {
            console.error('[SYNC] Échec rechargement:', error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- 2. CHARGEMENT INITIAL : serveur d'abord, cache en fallback ---
    const loadDataFromCache = useCallback(async () => {
        setIsLoading(true);

        const currentRestaurantId = getRestaurantId();
        if (currentRestaurantId) setRestaurantId(currentRestaurantId);

        // Tenter le fetch serveur en priorité (le serveur est la source de vérité)
        try {
            await fetchAndCacheAllData();
            console.log('[INIT] ✅ Données chargées depuis le serveur');
        } catch {
            // Si le serveur est injoignable, utiliser le cache comme fallback
            const cachedCategories = await AsyncStorage.getItem(GROUP_MENU_KEY);
            const cachedMenus = await AsyncStorage.getItem(MENU_KEY);

            if (cachedCategories && cachedMenus) {
                setCategories(JSON.parse(cachedCategories));
                setMenus(JSON.parse(cachedMenus));
                console.log('[INIT] ⚠️ Serveur inaccessible — données cache utilisées');
            }
            setIsLoading(false);
        }
    }, [fetchAndCacheAllData]);

    // --- 3. GESTION DES ÉTAPES ---
    const getStepsForMenu = useCallback(async (menuId, mode = null) => {
        const STEPS_KEY = `@steps_menu_${menuId}_${mode || 'all'}`;
        const isCacheInvalid = await AsyncStorage.getItem(STEPS_INVALIDATION_FLAG);

        if (isCacheInvalid !== 'true') {
            const cached = await AsyncStorage.getItem(STEPS_KEY);
            if (cached) {
                console.log(`[STEPS] Cache pour menu ${menuId}`);
                return JSON.parse(cached);
            }
        }

        const accessToken = await getOrRefreshToken();
        if (!accessToken) return [];

        try {
            const url = `${getPosUrl()}/menu/api/stepListByMenu/${menuId}/${mode ? `?mode=${mode}` : ''}`;
            const response = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            await AsyncStorage.setItem(STEPS_KEY, JSON.stringify(response.data));
            if (isCacheInvalid === 'true') await AsyncStorage.removeItem(STEPS_INVALIDATION_FLAG);
            return response.data;
        } catch (error) {
            console.error(`[STEPS] Erreur menu ${menuId}:`, error);
            return [];
        }
    }, []);

    // --- 4. DÉMARRAGE ---
    useEffect(() => {
        loadDataFromCache();

        // S'enregistrer auprès de BorneSyncProvider pour recevoir les demandes de sync
        addMenuRefreshListener(fetchAndCacheAllData);

        return () => {
            removeMenuRefreshListener(fetchAndCacheAllData);
        };
    }, [loadDataFromCache, fetchAndCacheAllData]);

    return {
        categories,
        menus,
        isLoading,
        fetchAndCacheAllData,
        getStepsForMenu,
        restaurantId,
    };
}
