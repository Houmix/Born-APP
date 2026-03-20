import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { BorneSyncProvider } from "@/contexts/BorneSyncProvider";
import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadServerUrl, hasSavedServerUrl, getPosUrl,
  loadRestaurantId, getRestaurantId, saveRestaurantId,
  clearServerUrl,
} from "@/utils/serverConfig";
import ServerSetup from "@/components/ServerSetup";
import ManagerLogin from "@/components/ManagerLogin";

// Clé AsyncStorage pour la date d'expiration de licence
const LICENSE_EXPIRY_KEY = 'license_expires_at';

type AppState =
  | 'loading'       // démarrage
  | 'setup'         // aucun serveur configuré → ServerSetup
  | 'login'         // serveur OK mais restaurant_id inconnu → connexion manager
  | 'no_server'     // serveur configuré mais injoignable + pas de licence en cache
  | 'no_license'    // licence expirée ou absente (confirmée par le serveur)
  | 'ready';        // tout OK → afficher l'app

async function cacheLicenseExpiry(expiresAt: string | null) {
  if (expiresAt) {
    await AsyncStorage.setItem(LICENSE_EXPIRY_KEY, expiresAt);
  }
}

async function getCachedExpiresAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LICENSE_EXPIRY_KEY);
  } catch {
    return null;
  }
}

function isCachedLicenseStillValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

export default function RootLayout() {
  const [appState, setAppState] = useState<AppState>('loading');

  // ─── Ping serveur local ───────────────────────────────────────────────────
  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(`${getPosUrl()}/api/sync/discover/`, { signal: controller.signal });
      clearTimeout(t);
      return resp.ok;
    } catch {
      return false;
    }
  }, []);

  // ─── Vérification licence sur le serveur (avec restaurant_id connu) ───────
  const checkLicenseOnServer = useCallback(async (restaurantId: string): Promise<{ valid: boolean; expiresAt: string | null }> => {
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
    await loadRestaurantId();

    const hasUrl = await hasSavedServerUrl();
    const restaurantId = getRestaurantId();
    const cachedExpiry = await getCachedExpiresAt();
    const cacheValid = isCachedLicenseStillValid(cachedExpiry);

    // Pas de serveur configuré → ServerSetup
    if (!hasUrl) {
      setAppState('setup');
      return;
    }

    // Ping du serveur local
    const serverOk = await pingServer();

    if (!serverOk) {
      if (cacheValid) {
        // Serveur injoignable mais licence en cache encore valide → mode dégradé
        setAppState('ready');
      } else {
        // Serveur injoignable et aucun cache valide → bloquer
        setAppState('no_server');
      }
      return;
    }

    // Serveur joignable mais restaurant_id pas encore connu → login manager
    if (!restaurantId) {
      setAppState('login');
      return;
    }

    // Serveur joignable + restaurant_id connu → vérifier la licence
    const { valid, expiresAt } = await checkLicenseOnServer(restaurantId);

    if (valid) {
      await cacheLicenseExpiry(expiresAt);
      setAppState('ready');
    } else {
      // Licence invalide côté serveur → effacer le cache et bloquer
      await AsyncStorage.removeItem(LICENSE_EXPIRY_KEY);
      setAppState('no_license');
    }
  }, [pingServer, checkLicenseOnServer]);

  useEffect(() => { init(); }, [init]);

  // ─── Callbacks des composants enfants ─────────────────────────────────────

  const handleServerConfigured = useCallback(async () => {
    // Après ServerSetup → toujours demander la connexion manager
    setAppState('login');
  }, []);

  const handleLoginSuccess = useCallback(async (restaurantId: string, expiresAt: string | null) => {
    // Login manager réussi + licence vérifiée → mettre en cache et lancer l'app
    await cacheLicenseExpiry(expiresAt);
    setAppState('ready');
  }, []);

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

  if (appState === 'login') {
    return (
      <ManagerLogin
        onSuccess={handleLoginSuccess}
        onBack={handleReconfigure}
      />
    );
  }

  if (appState === 'no_server') {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>📡</Text>
        <Text style={styles.splashTitle}>Serveur introuvable</Text>
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

  if (appState === 'no_license') {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>🔒</Text>
        <Text style={styles.splashTitle}>Licence inactive</Text>
        <Text style={styles.splashSub}>
          Aucune licence active trouvée pour ce restaurant.{'\n'}
          Contactez l'administrateur ClickGo pour activer votre abonnement.
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
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  splashSub: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: '#756fbf',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
