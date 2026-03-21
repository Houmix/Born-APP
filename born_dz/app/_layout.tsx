import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { BorneSyncProvider } from "@/contexts/BorneSyncProvider";
import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadServerUrl, hasSavedServerUrl, getPosUrl,
  saveRestaurantId, getRestaurantId,
  clearServerUrl,
} from "@/utils/serverConfig";
import ServerSetup from "@/components/ServerSetup";
import { startServerMonitor, addStatusListener, removeStatusListener, ServerStatus } from "@/utils/serverMonitor";
import { getQueueSize } from "@/utils/orderQueue";

const LICENSE_EXPIRY_KEY = 'license_expires_at';

type AppState =
  | 'loading'     // démarrage
  | 'setup'       // aucun serveur configuré → ServerSetup
  | 'no_server'   // serveur injoignable + pas de licence en cache
  | 'no_data'     // serveur joignable mais POS pas encore initialisé
  | 'no_license'  // licence expirée ou absente
  | 'ready';      // tout OK

async function cacheLicenseExpiry(expiresAt: string | null) {
  if (expiresAt) await AsyncStorage.setItem(LICENSE_EXPIRY_KEY, expiresAt);
  else await AsyncStorage.removeItem(LICENSE_EXPIRY_KEY);
}

async function getCachedExpiresAt(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LICENSE_EXPIRY_KEY); } catch { return null; }
}

function isCachedLicenseStillValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

export default function RootLayout() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [serverStatus, setServerStatus] = useState<ServerStatus>('online');
  const [queueSize, setQueueSize]       = useState(0);

  // ─── Discover : ping + récupère restaurant_id depuis la caisse ───────────
  const discoverServer = useCallback(async (): Promise<{ ok: boolean; restaurantId: string | null }> => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(`${getPosUrl()}/api/sync/discover/`, { signal: controller.signal });
      clearTimeout(t);
      if (resp.ok) {
        const data = await resp.json();
        const rid = data.restaurant_id ? data.restaurant_id.toString() : null;
        return { ok: true, restaurantId: rid };
      }
      return { ok: false, restaurantId: null };
    } catch {
      return { ok: false, restaurantId: null };
    }
  }, []);

  // ─── Vérification licence sur la caisse ──────────────────────────────────
  const checkLicense = useCallback(async (restaurantId: string): Promise<{ valid: boolean; expiresAt: string | null }> => {
    try {
      const res = await fetch(
        `${getPosUrl()}/api/license/restaurant-status/?restaurant_id=${restaurantId}`,
        // @ts-ignore
        { timeout: 5000 }
      );
      const data = await res.json();
      return { valid: data.valid === true, expiresAt: data.expires_at || null };
    } catch {
      return { valid: false, expiresAt: null };
    }
  }, []);

  // ─── Séquence principale ──────────────────────────────────────────────────
  const init = useCallback(async () => {
    setAppState('loading');

    await loadServerUrl();

    const hasUrl = await hasSavedServerUrl();
    if (!hasUrl) {
      setAppState('setup');
      return;
    }

    const cachedExpiry = await getCachedExpiresAt();
    const cacheValid = isCachedLicenseStillValid(cachedExpiry);

    // Découverte du serveur caisse (ping + restaurant_id)
    const { ok: serverOk, restaurantId: discoveredId } = await discoverServer();

    if (!serverOk) {
      setAppState(cacheValid ? 'ready' : 'no_server');
      return;
    }

    // Sauvegarder le restaurant_id si la caisse en retourne un
    if (discoveredId) {
      await saveRestaurantId(discoveredId);
    }

    const restaurantId = discoveredId || getRestaurantId();

    if (!restaurantId) {
      // Caisse joignable mais pas encore initialisée (SetupWizard pas fait)
      setAppState('no_data');
      return;
    }

    // Vérification licence
    const { valid, expiresAt } = await checkLicense(restaurantId);
    if (valid) {
      await cacheLicenseExpiry(expiresAt);
      setAppState('ready');
    } else {
      await cacheLicenseExpiry(null);
      setAppState(cacheValid ? 'ready' : 'no_license');
    }
  }, [discoverServer, checkLicense]);

  useEffect(() => { init(); }, [init]);

  // ─── Surveillance serveur (ping + re-scan IP + file d'attente) ───────────
  useEffect(() => {
    startServerMonitor();

    const onStatus: Parameters<typeof addStatusListener>[0] = async (status) => {
      setServerStatus(status);
      // Mettre à jour le compteur de la file
      const sz = await getQueueSize();
      setQueueSize(sz);
    };

    addStatusListener(onStatus);
    return () => removeStatusListener(onStatus);
  }, []);

  const handleServerConfigured = useCallback(() => { init(); }, [init]);
  const handleReconfigure = useCallback(async () => {
    await clearServerUrl();
    setAppState('setup');
  }, []);

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (appState === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#756fbf" />
        <Text style={styles.splashSub}>Démarrage...</Text>
      </View>
    );
  }

  if (appState === 'setup') {
    return <ServerSetup onConfigured={handleServerConfigured} />;
  }

  if (appState === 'no_server') {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>📡</Text>
        <Text style={styles.splashTitle}>Caisse introuvable</Text>
        <Text style={styles.splashSub}>
          Impossible de joindre la caisse.{'\n'}
          Vérifiez que le logiciel caisse est démarré{'\n'}et que vous êtes sur le même réseau Wi-Fi.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={init}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleReconfigure}>
          <Text style={[styles.btnText, { color: '#aaa' }]}>Changer de serveur</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (appState === 'no_data') {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>⚙️</Text>
        <Text style={styles.splashTitle}>Caisse non initialisée</Text>
        <Text style={styles.splashSub}>
          La caisse est joignable mais n'a pas encore été configurée.{'\n'}
          Lancez d'abord la configuration sur le logiciel caisse.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={init}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (appState === 'no_license') {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>🔒</Text>
        <Text style={styles.splashTitle}>Licence inactive</Text>
        <Text style={styles.splashSub}>
          Aucune licence active pour ce restaurant.{'\n'}
          Contactez l'administrateur ClickGo.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={init}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleReconfigure}>
          <Text style={[styles.btnText, { color: '#aaa' }]}>Changer de serveur</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <BorneSyncProvider>
      <LanguageProvider>
        <KioskThemeProvider>
          {/* Bannière hors-ligne discrète (coin supérieur) */}
          {serverStatus !== 'online' && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                {serverStatus === 'reconnecting'
                  ? '🔍 Recherche de la caisse…'
                  : `📡 Caisse hors ligne${queueSize > 0 ? ` — ${queueSize} commande(s) en attente` : ''}`
                }
              </Text>
            </View>
          )}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </KioskThemeProvider>
      </LanguageProvider>
    </BorneSyncProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  splashIcon: { fontSize: 64, marginBottom: 16 },
  splashTitle: {
    fontSize: 28, fontWeight: '700', color: '#fff',
    marginBottom: 16, textAlign: 'center',
  },
  splashSub: {
    fontSize: 15, color: '#888', textAlign: 'center',
    lineHeight: 24, marginTop: 8, marginBottom: 32,
  },
  btn: {
    backgroundColor: '#756fbf', paddingVertical: 14,
    paddingHorizontal: 40, borderRadius: 12, marginTop: 12,
    minWidth: 220, alignItems: 'center',
  },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#444' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  offlineBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  offlineBannerText: { color: 'white', fontWeight: '700', fontSize: 13 },
});
