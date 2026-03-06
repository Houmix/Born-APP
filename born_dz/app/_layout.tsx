import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { loadServerUrl, hasSavedServerUrl, getPosUrl } from "@/utils/serverConfig";
import ServerSetup from "@/components/ServerSetup";
import axios from "axios";
import { idRestaurant } from "@/config";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [licenseValid, setLicenseValid] = useState(true);

  const checkLicense = useCallback(async () => {
    try {
      const response = await axios.get(
        `${getPosUrl()}/api/license/restaurant-status/?restaurant_id=${idRestaurant}`,
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

      if (!hasUrl) {
        setNeedsSetup(true);
        setReady(true);
        return;
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
    <LanguageProvider>
      <KioskThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </KioskThemeProvider>
    </LanguageProvider>
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
