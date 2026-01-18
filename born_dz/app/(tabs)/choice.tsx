import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { POS_URL, idRestaurant } from "@/config";
import { useEffect } from "react";

// Assurez-vous que votre logo est bien à cet emplacement
const LOGO_SOURCE = require('@/assets/logo.png');

export default function IndexScreen() {
  const router = useRouter();

  // Fonction pour récupérer le token anonyme et configurer le restaurant
  const getToken = async () => {
    try {
      const response = await axios.post(`${POS_URL}/user/api/user/token/0`);
      
      if (response.status == 200 || response.status == 201) {
        console.log("✅ Token anonyme récupéré");
        
        // ✅ Stocker le token ET le restaurant
        await AsyncStorage.setItem("token", response.data.access);
        await AsyncStorage.setItem("Employee_restaurant_id", idRestaurant.toString());
        await AsyncStorage.setItem("Employee_id", "0");  // Anonyme
        await AsyncStorage.removeItem("lastOrderId"); 
                await AsyncStorage.removeItem("orderList"); // Vide les articles
                await AsyncStorage.removeItem("pendingOrder"); // Vide la commande en cours
        console.log(`✅ Configuration:`, {
          token: response.data.access,
          restaurant: idRestaurant,
          employee: 0
        });
      } else {
        console.log("❌ Erreur récupération token");
      }
    } catch (error) {
      console.log("❌ Erreur dans getToken:", error);
    }
  };

  // Exécuté au chargement de la page
  useEffect(() => {
    
    getToken();
  }, []);

  return (
    <View style={styles.main}>
      
      {/* Header avec Logo */}
      <View style={styles.header}>
        <Image 
            source={LOGO_SOURCE} 
            style={styles.logo} 
            resizeMode="contain" 
        />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.subtitle}>Bienvenue, que souhaitez-vous faire ?</Text>

        <View style={styles.cardsContainer}>
            
            {/* 🔹 CARTE 1 : S'IDENTIFIER (Bleu Royal) */}
            <TouchableOpacity 
              style={[styles.card, styles.cardBlue]} 
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/identification")}
            >
              <View style={styles.iconCircle}>
                {/* Icône Feather souvent plus propre, mais MaterialIcons fonctionne très bien aussi */}
                <MaterialIcons name="perm-identity" size={60} color="#0056b3" />
              </View>
              <Text style={styles.cardTitle}>S'identifier</Text>
              <Text style={styles.cardDescription}>
                 Compte fidélité & Historique
              </Text>
            </TouchableOpacity>

            {/* 🔸 CARTE 2 : COMMANDER (Rose Vif - Action Principale) */}
            <TouchableOpacity 
              style={[styles.card, styles.cardPink]} 
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/terminal")}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="fast-food" size={60} color="#ff69b4" />
              </View>
              <Text style={styles.cardTitle}>Commander</Text>
              <Text style={styles.cardDescription}>
                 Accéder au menu & Commander
              </Text>
            </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

// Détection simple pour tablette vs mobile
const { width } = Dimensions.get('window');
const isTablet = width > 600;

const styles = StyleSheet.create({
    main: {
        flex: 1,
        backgroundColor: "#F8F9FA", // Fond blanc cassé "Premium"
    },
    header: {
        height: "15%",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        paddingTop: 20,
        elevation: 2,
    },
    logo: {
        width: 250,
        height: 150,
    },
    contentContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    subtitle: {
        fontSize: 26,
        fontWeight: "300",
        color: "#64748B",
        marginBottom: 40,
        textAlign: "center",
        letterSpacing: 1,
    },
    cardsContainer: {
        flexDirection: isTablet ? "row" : "column", // Responsive
        justifyContent: "center",
        alignItems: "center",
        gap: 30,
        width: "100%",
        height: "60%", 
    },
    // Style de base des cartes
    card: {
        flex: 1,
        width: isTablet ? "45%" : "90%", // Si mobile, prend toute la largeur
        height: "100%",
        maxHeight: 400,
        borderRadius: 30,
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
    },
    // Couleurs spécifiques
    cardBlue: {
        backgroundColor: "#0056b3", // Bleu Royal
    },
    cardPink: {
        backgroundColor: "#ff69b4", // Rose Vif
    },
    // Cercles blancs pour les icônes
    iconCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 25,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    // Typographie
    cardTitle: {
        color: "white",
        fontSize: 34,
        fontWeight: "800",
        marginBottom: 10,
        textTransform: "uppercase",
        textAlign: "center",
    },
    cardDescription: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 18,
        fontWeight: "500",
        textAlign: "center",
    },
});