import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; 
import { useState, useEffect, useCallback, useRef } from 'react';
import { POS_URL, idRestaurant} from '@/config';

const WEBSOCKET_URL = `${POS_URL}/ws/borne/sync/`;
const GROUP_MENU_KEY = 'GroupMenu';
const MENU_KEY = 'Menu';
const STEPS_INVALIDATION_FLAG = 'steps_cache_invalidated';

export function useBorneSync() {
    const [categories, setCategories] = useState([]);
    const [menus, setMenus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const ws = useRef(null);
    const [restaurantId, setRestaurantId] = useState(null);

    // --- 1. CHARGEMENT DES DONNÉES ---
    const fetchAndCacheAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const accessToken = await AsyncStorage.getItem("token");
            const currentRestaurantId = idRestaurant;
            
            if (!accessToken || !currentRestaurantId) {
                console.error("[SYNC ERROR] Token ou ID Restaurant manquant.");
                Alert.alert("Erreur d'authentification", "Veuillez vous reconnecter.");
                return;
            }
            
            setRestaurantId(currentRestaurantId);
            const headers = { Authorization: `Bearer ${accessToken}` };

            // Récupération des catégories
            const categoriesResponse = await axios.get(
                `${POS_URL}/menu/api/getGroupMenuList/${currentRestaurantId}/`, 
                { headers }
            );
            const availableCategories = categoriesResponse.data.filter((category) => category.avalaible);
            setCategories(availableCategories);
            await AsyncStorage.setItem(GROUP_MENU_KEY, JSON.stringify(availableCategories));

            // Récupération des menus
            const menusResponse = await axios.get(
                `${POS_URL}/menu/api/getAllMenu/${currentRestaurantId}/`, 
                { headers }
            );
            setMenus(menusResponse.data);
            await AsyncStorage.setItem(MENU_KEY, JSON.stringify(menusResponse.data));

            console.log('[SYNC] ✅ Données rechargées et mises en cache');

        } catch (error) {
            console.error('[SYNC ERROR] Échec du rechargement:', error.message);
            Alert.alert("Erreur de Synchro", "Échec du rechargement des données.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- 2. CHARGEMENT INITIAL DEPUIS LE CACHE ---
    const loadDataFromCache = useCallback(async () => {
        setIsLoading(true);
        
        const currentRestaurantId = idRestaurant;
        if (currentRestaurantId) {
            setRestaurantId(currentRestaurantId);
        }

        const cachedCategories = await AsyncStorage.getItem(GROUP_MENU_KEY);
        const cachedMenus = await AsyncStorage.getItem(MENU_KEY);

        if (cachedCategories && cachedMenus) {
            setCategories(JSON.parse(cachedCategories));
            setMenus(JSON.parse(cachedMenus));
            console.log('[CACHE] ✅ Données chargées depuis le cache');
        }
        
        // Toujours synchroniser après pour avoir les données fraîches
        await fetchAndCacheAllData(); 
    }, [fetchAndCacheAllData]);
    
    // --- 3. WEBSOCKET ---
    const connectWebSocket = useCallback(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log('[WS] Déjà connecté');
            return;
        }
    
        console.log('[WS] Connexion...');
        const socket = new WebSocket(WEBSOCKET_URL);
        ws.current = socket;
    
        socket.onopen = () => {
            console.log('[WS] ✅ Connecté au serveur');
        };

        socket.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('[WS] 📥 Message reçu:', data.type);
                
                // Si le serveur demande un rechargement
                if (data.type === 'sync_message' && data.data.status === 'full_sync_required') {
                    console.log('[WS] 🔄 Rechargement demandé par le serveur');
                    fetchAndCacheAllData();
                }
            } catch (error) {
                console.error('[WS] Erreur traitement message:', error);
            }
        };
    
        socket.onclose = (e) => {
            console.log('[WS] ❌ Connexion fermée. Reconnexion dans 5s...');
            setTimeout(connectWebSocket, 5000);
        };
    
        socket.onerror = (error) => {
            console.error('[WS] ❌ Erreur:', error.message);
            socket.close();
        };
    }, [fetchAndCacheAllData]);
    
    // --- 4. GESTION DES ÉTAPES ---
    const getStepsForMenu = useCallback(async (menuId) => {
        const STEPS_KEY = `@steps_menu_${menuId}`;
        const accessToken = await AsyncStorage.getItem("token");

        if (!accessToken) return [];

        const headers = { Authorization: `Bearer ${accessToken}` };
        const isCacheInvalid = await AsyncStorage.getItem(STEPS_INVALIDATION_FLAG);
        
        let cachedSteps = null;
        if (isCacheInvalid !== 'true') {
            cachedSteps = await AsyncStorage.getItem(STEPS_KEY);
            if (cachedSteps) {
                console.log(`[STEPS] Chargées depuis le cache pour menu ${menuId}`);
                return JSON.parse(cachedSteps);
            }
        }
        
        try {
            console.log(`[STEPS] Récupération API pour menu ${menuId}`);
            const response = await axios.get(`${POS_URL}/menu/api/stepListByMenu/${menuId}/`, { headers });
            
            await AsyncStorage.setItem(STEPS_KEY, JSON.stringify(response.data));
            if (isCacheInvalid === 'true') {
                await AsyncStorage.removeItem(STEPS_INVALIDATION_FLAG);
            }

            return response.data;
            
        } catch (error) {
            console.error(`[STEPS] Erreur pour menu ${menuId}:`, error);
            return [];
        }
    }, []);

    // --- 5. DÉMARRAGE ---
    useEffect(() => {
        loadDataFromCache();
        connectWebSocket();

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                console.log('[APP] Retour au premier plan');
                if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
                    console.log('[APP] Reconnexion WebSocket...');
                    connectWebSocket();
                }
            }
        });

        return () => {
            subscription.remove();
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [loadDataFromCache, connectWebSocket]);

    return { 
        categories, 
        menus, 
        isLoading, 
        fetchAndCacheAllData, 
        getStepsForMenu, 
        restaurantId,
    };
}