// components/ManagerLogin.tsx
// Écran de connexion manager/owner pour identifier le restaurant
// et vérifier la licence au premier démarrage de la borne.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import axios from 'axios';
import { getPosUrl, saveRestaurantId } from '@/utils/serverConfig';

interface Props {
  onSuccess: (restaurantId: string, expiresAt: string | null) => void;
  onBack: () => void; // revenir à ServerSetup
}

const ALLOWED_ROLES = ['manager', 'owner'];

export default function ManagerLogin({ onSuccess, onBack }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez renseigner votre téléphone et mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Login sur le serveur local
      const loginRes = await axios.post(
        `${getPosUrl()}/user/api/employee/token/`,
        { phone: phone.trim(), password },
        { timeout: 8000 }
      );

      const { restaurant_id, user } = loginRes.data;
      const roleName: string = user?.role_name || '';

      // 2. Vérifier que c'est bien un manager ou owner
      if (!ALLOWED_ROLES.includes(roleName.toLowerCase())) {
        setError('Accès réservé au manager ou au propriétaire du restaurant.');
        setLoading(false);
        return;
      }

      if (!restaurant_id) {
        setError('Impossible de récupérer le restaurant associé à ce compte.');
        setLoading(false);
        return;
      }

      // 3. Sauvegarder le restaurant_id
      await saveRestaurantId(restaurant_id.toString());

      // 4. Vérifier la licence sur le serveur local
      const licRes = await axios.get(
        `${getPosUrl()}/api/license/restaurant-status/?restaurant_id=${restaurant_id}`,
        { timeout: 5000 }
      );

      if (!licRes.data.valid) {
        const reason = licRes.data.reason || 'no_license';
        if (reason === 'expired') {
          setError('La licence de ce restaurant a expiré. Contactez l\'administrateur ClickGo.');
        } else {
          setError('Aucune licence active pour ce restaurant. Contactez l\'administrateur ClickGo.');
        }
        setLoading(false);
        return;
      }

      // 5. Succès → passer l'expires_at au parent pour mise en cache
      onSuccess(restaurant_id.toString(), licRes.data.expires_at || null);

    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('Identifiants incorrects ou accès refusé.');
      } else if (err?.code === 'ECONNABORTED' || !err?.response) {
        setError('Serveur inaccessible. Vérifiez la connexion au POS.');
      } else {
        setError(err?.response?.data?.error || 'Erreur de connexion.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.icon}>🏪</Text>
        <Text style={styles.title}>Connexion Manager</Text>
        <Text style={styles.subtitle}>
          Connectez-vous pour activer cette borne
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Numéro de téléphone"
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe (6 chiffres)"
          placeholderTextColor="#64748b"
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Se connecter</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={onBack} disabled={loading}>
          <Text style={styles.backText}>← Changer de serveur</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  icon: { fontSize: 52, marginBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 14,
  },
  btn: {
    backgroundColor: '#756fbf',
    borderRadius: 12,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { marginTop: 20 },
  backText: { color: '#475569', fontSize: 13 },
});
