import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector"; // Si vous l'avez créé

// Assurez-vous que le chemin du logo est correct
const LOGO_SOURCE = require('@/assets/logo.png');

export default function HomeScreen() {
  const router = useRouter();
  // Si vous n'avez pas encore le contexte de langue ici, vous pouvez retirer ces lignes
  // const { t } = useLanguage(); 

  return (
    <View style={styles.main}>
        
        {/* Header avec Logo et Langue */}
        <View style={styles.header}>
            <Image 
                source={LOGO_SOURCE} 
                style={styles.logo} 
                resizeMode="contain" 
            />
            {/* On peut remettre le sélecteur de langue ici si besoin */}
            {/* <LanguageSelector /> */}
        </View>
        
        <View style={styles.container}>
            <Text style={styles.subtitle}>Que souhaitez-vous faire ?</Text>

            <View style={styles.cardsContainer}>
                
                {/* 🔹 CARTE 1 : S'IDENTIFIER (Bleu Royal) */}
                <TouchableOpacity 
                    style={[styles.card, styles.cardBlue]} 
                    activeOpacity={0.8}
                    onPress={() => router.push("/identification")}
                >
                    <View style={styles.iconCircleBlue}>
                        <Feather name="user" size={50} color="#0056b3" />
                    </View>
                    <Text style={styles.cardTitle}>Compte Fidélité</Text>
                    <Text style={styles.cardDescription}>
                        Identifiez-vous pour cumuler des points
                    </Text>
                </TouchableOpacity>

                {/* 🔸 CARTE 2 : COMMANDER (Rose Vif - Action Principale) */}
                <TouchableOpacity 
                    style={[styles.card, styles.cardPink]} 
                    activeOpacity={0.8}
                    onPress={() => router.push("/terminal")}
                >
                    <View style={styles.iconCirclePink}>
                        <MaterialIcons name="restaurant-menu" size={50} color="#ff69b4" />
                    </View>
                    <Text style={styles.cardTitle}>Commander</Text>
                    <Text style={styles.cardDescription}>
                        Accédez au menu et commandez directement
                    </Text>
                </TouchableOpacity>

            </View>
        </View>
    </View>
  );
}

const { width } = Dimensions.get('window');
const isTablet = width > 600;

const styles = StyleSheet.create({
    main: {
        flex: 1,
        backgroundColor: "#F8F9FA", // Fond blanc cassé très léger pour le premium
    },
    header: {
        height: "15%",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 40,
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        elevation: 2,
    },
    logo: {
        width: 200,
        height: 60,
    },
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    subtitle: {
        fontSize: 28,
        fontWeight: "300",
        color: "#64748B",
        marginBottom: 40,
        textAlign: "center",
        letterSpacing: 1,
    },
    cardsContainer: {
        flexDirection: isTablet ? "row" : "column", // Responsive : Ligne sur tablette, Colonne sur petit écran
        justifyContent: "center",
        alignItems: "center",
        gap: 30,
        width: "100%",
        height: "60%", // Occupe bien l'espace central
    },
    card: {
        flex: 1,
        width: isTablet ? "45%" : "90%",
        height: "100%",
        maxHeight: 400, // Limite la hauteur pour l'esthétique
        borderRadius: 30,
        padding: 30,
        justifyContent: "center",
        alignItems: "center",
        elevation: 10, // Belle ombre Android
        shadowColor: "#000", // Ombre iOS
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    // --- Style Carte Bleue (Identification) ---
    cardBlue: {
        backgroundColor: "#0056b3", // Votre Bleu Royal
    },
    iconCircleBlue: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        elevation: 5,
    },
    // --- Style Carte Rose (Commande) ---
    cardPink: {
        backgroundColor: "#ff69b4", // Votre Rose Vif
    },
    iconCirclePink: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        elevation: 5,
    },
    // --- Textes ---
    cardTitle: {
        fontSize: 32,
        fontWeight: "800",
        color: "white",
        marginBottom: 10,
        textAlign: "center",
        textTransform: "uppercase",
    },
    cardDescription: {
        fontSize: 18,
        color: "rgba(255, 255, 255, 0.9)",
        textAlign: "center",
        lineHeight: 24,
        fontWeight: "500",
    },
});