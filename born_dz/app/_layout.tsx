import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { BorneSyncProvider } from "@/contexts/BorneSyncProvider";
import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { loadServerUrl, hasSavedServerUrl, getPosUrl, loadRestaurantId, getRestaurantId, saveRestaurantId } from "@/utils/serverConfig";
import ServerSetup from "@/components/ServerSetup";
import axios from "axios";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [licenseValid, setLicenseValid] = useState(true);

  const checkLicense = useCallback(async () => {
    const restaurantId = getRestaurantId();
    try {
      const response = await axios.get(
        `${getPosUrl()}/api/license/restaurant-status/?restaurant_id=${restaurantId || 1}`,
        { timeout: 5000 }
      );
      setLicenseValid(response.data.valid === true);
    } catch {
      // Serveur injoignable → mode optimiste (la caisse peut être hors ligne temporairement)
      setLicenseValid(true);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const hasUrl = await hasSavedServerUrl();
      await loadServerUrl();
      await loadRestaurantId();

      if (!hasUrl) {
        setNeedsSetup(true);
        setReady(true);
        return;
      }

      // Si le restaurant_id n'est pas encore sauvegardé (ancienne session), le récupérer via discover
      if (!getRestaurantId()) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch(`${getPosUrl()}/api/sync/discover/`, { signal: controller.signal });
          clearTimeout(t);
          if (resp.ok) {
            const data = await resp.json();
            if (data.restaurant_id) {
              await saveRestaurantId(data.restaurant_id.toString());
              console.log('[Layout] restaurant_id récupéré via discover:', data.restaurant_id);
            }
          }
        } catch (e) {
          console.warn('[Layout] discover échoué, restaurant_id reste null');
        }
      }

      await checkLicense();
      setReady(true);
    }
    init();
  }, [checkLicense]);

  const handleConfigured = async (url: string) => {
    setNeedsSetup(false);
    await checkLicense();
    setReady(true);
  };

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#756fbf" />
        <Text style={styles.splashSub}>Démarrage...</Text>
      </View>
    );
  }

  if (needsSetup) {
    return <ServerSetup onConfigured={handleConfigured} />;
  }

  if (!licenseValid) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>🔒</Text>
        <Text style={styles.splashTitle}>Borne désactivée</Text>
        <Text style={styles.splashSub}>
          La licence de la caisse est inactive ou expirée.{'\n'}
          Contactez l'administrateur ClickGo.
        </Text>
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
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  splashSub: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 12,
  },
});
