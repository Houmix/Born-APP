import { useEffect, useState } from "react";
import { Text, View, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from "expo-router";
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";

export default function identificationScreen() {
    const navigation = useNavigation();
    const [errorMessage, setErrorMessage] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");

    useEffect(() => {
        // Nettoyer uniquement les données utilisateur, pas le token anonyme
        const clearUserData = async () => {
            try {
                await AsyncStorage.removeItem("User_id");
                await AsyncStorage.removeItem("User_phone");
                await AsyncStorage.removeItem("lastOrderId"); 
                await AsyncStorage.removeItem("orderList"); // Vide les articles
                await AsyncStorage.removeItem("pendingOrder"); // Vide la commande en cours
                console.log("✅ Données utilisateur précédentes supprimées");
            } catch (e) {
                console.error("❌ Erreur suppression:", e);
            }
        };
        clearUserData();
    }, []);

    // ✅ FONCTION PRINCIPALE : Récupère ou crée l'utilisateur
    const handleSubmit = async () => {
        try {
            setErrorMessage("");
            
            if (!phoneNumber || phoneNumber.length < 10) {
                setErrorMessage("Numéro de téléphone invalide");
                return;
            }
            
            console.log(`📤 Connexion/Création utilisateur: ${phoneNumber}`);
            
            // ✅ ÉTAPE 1 : Récupérer ou créer le token
            const tokenResponse = await axios.post(
                `${getPosUrl()}/user/api/user/token/`,
                { phone: phoneNumber }
            );
            
            const accessToken = tokenResponse.data.access;
            
            if (tokenResponse.status === 201) {
                console.log("✅ Nouvel utilisateur créé!");
            } else {
                console.log("✅ Utilisateur existant trouvé!");
            }
            
            // ✅ ÉTAPE 2 : Récupérer les détails de l'utilisateur
            const userResponse = await axios.post(
                `${getPosUrl()}/user/api/getUser/`,
                { phone: phoneNumber },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
            
            const userData = userResponse.data;
            console.log("✅ Données utilisateur:", userData);
            
            // ✅ ÉTAPE 3 : Sauvegarder dans AsyncStorage
            await AsyncStorage.setItem("token", accessToken);
            await AsyncStorage.setItem("User_id", userData.id.toString());
            await AsyncStorage.setItem("User_phone", userData.phone);
            await AsyncStorage.setItem("Employee_id", userData.id.toString());
            await AsyncStorage.setItem("Employee_restaurant_id", getRestaurantId().toString());
            
            console.log("✅ Session utilisateur créée:", {
                user_id: userData.id,
                phone: userData.phone,
                restaurant: getRestaurantId()
            });
            
            // ✅ ÉTAPE 4 : Redirection
            navigation.navigate("terminal");
            
        } catch (error) {
            console.error("❌ Erreur:", error.response?.data || error.message);
            
            if (error.response?.status === 404) {
                setErrorMessage("Utilisateur introuvable");
            } else if (error.response?.status === 500) {
                setErrorMessage("Erreur serveur");
            } else if (error.response?.status === 400) {
                setErrorMessage("Numéro de téléphone invalide");
            } else {
                setErrorMessage("Erreur de connexion");
            }
        }
    };

    // ✅ MODE ANONYME
    const handleIgnore = async () => {
        try {
            console.log("🔍 Mode anonyme activé");
            
            // Vérifier le token anonyme
            let token = await AsyncStorage.getItem("token");
            let restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
            
            // Si manquants, les récupérer
            if (!token || !restaurantId) {
                console.log("⚠️ Token manquant, récupération...");
                
                const response = await axios.post(
                    `${getPosUrl()}/user/api/user/token/`,
                    { phone: null }
                );
                
                token = response.data.access;
                
                await AsyncStorage.setItem("token", token);
                await AsyncStorage.setItem("Employee_restaurant_id", getRestaurantId().toString());
            }
            
            // Mode anonyme : Employee_id = 0
            await AsyncStorage.setItem("Employee_id", "0");
            
            console.log("✅ Mode anonyme configuré:", {
                token: "Présent",
                restaurant: getRestaurantId(),
                employee: 0
            });
            
            navigation.navigate("terminal");
            
        } catch (error) {
            console.error("❌ Erreur mode anonyme:", error);
            setErrorMessage("Erreur lors de l'initialisation");
        }
    };

    return (
        <View style={styles.main}>
            <View style={styles.textBox}>
                {errorMessage && (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                )}
        
                <TextInput
                    style={styles.input}
                    placeholder="Numéro de téléphone"
                    keyboardType="numeric"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    editable={false}
                />
                
                {/* Clavier numérique */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
                    {[[1, 2, 3, 4, 5], [6, 7, 8, 9, 0]].map((row, rowIndex) => (
                        <View key={rowIndex} style={{ flexDirection: "row", justifyContent: "center" }}>
                            {row.map((num) => (
                                <TouchableOpacity
                                    key={num}
                                    style={[styles.button, { width: 60, height: 60, margin: 5 }]}
                                    onPress={() => setPhoneNumber((prev) => prev + num.toString())}
                                >
                                    <Text style={styles.txtBtn}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                    
                    {/* Bouton effacer */}
                    <TouchableOpacity
                        style={[styles.button, { width: 60, height: 60, margin: 5 }]}
                        onPress={() => setPhoneNumber((prev) => prev.slice(0, -1))}
                    >
                        <Text style={styles.txtBtn}>⌫</Text>
                    </TouchableOpacity>
                </View>
                
                {/* Boutons actions */}
                <TouchableOpacity 
                    style={[styles.button, styles.confirmButton]} 
                    onPress={handleSubmit}
                >
                    <Text style={styles.txtBtn}>Confirmer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.button, styles.ignoreButton]} 
                    onPress={handleIgnore}
                >
                    <Text style={styles.txtBtn}>Ignorer (Mode Anonyme)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    main: {
        flex: 1,
        flexDirection: 'column',
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
    },
    textBox: {
        height: "20%",
        flexDirection: "column",
        display: "flex",
        justifyContent: "center",
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        fontSize: 18,
        fontWeight: '600',
    },
    input: {
        width: "100%",
        height: 60,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        padding: 15,
        fontSize: 20,
        backgroundColor: "#fff",
        marginBottom: 20,
        textAlign: 'center',
    },
    button: {
        backgroundColor: "white",
        margin: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    confirmButton: {
        backgroundColor: "#4CAF50",
        marginTop: 20,
    },
    ignoreButton: {
        backgroundColor: "#9E9E9E",
    },
    txtBtn: {
        color: "black",
        fontSize: 15,
        fontWeight: "bold",
        textDecorationLine: "none",
    },
});