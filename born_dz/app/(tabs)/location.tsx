import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

const { width } = Dimensions.get('window');
const isTablet = width > 600;

export default function LocationScreen() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const [errorMessage, setErrorMessage] = useState("");
    const [customerIdentifier, setCustomerIdentifier] = useState("");

    useEffect(() => {
        const check = async () => {
            const stored = await AsyncStorage.getItem("pendingOrder");
            if (!stored) setErrorMessage(t('errors.no_order'));
        };
        check();
    }, []);

    const selectLocation = async (deliveryType: 'sur_place' | 'emporter' | 'livraison') => {
        try {
            const stored = await AsyncStorage.getItem("pendingOrder");
            if (!stored) {
                Alert.alert(t('error'), t('errors.no_order'));
                return;
            }
            await AsyncStorage.setItem("orderTakeaway", deliveryType !== 'sur_place' ? "true" : "false");
            await AsyncStorage.setItem("orderDeliveryType", deliveryType);
            await AsyncStorage.setItem("orderCustomerIdentifier", customerIdentifier.trim());
            router.push("/pay");
        } catch (err) {
            console.error("Erreur location :", err);
            Alert.alert(t('error'), t('errors.loading_data'));
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.main}>
            <View style={styles.titleBox}>
                <Text style={styles.title}>{t('location.title')}</Text>
            </View>

            {/* Champ identifiant client */}
            <View style={styles.identifierBox}>
                <Text style={styles.identifierLabel}>Votre nom / immatriculation / biper</Text>
                <TextInput
                    style={styles.identifierInput}
                    placeholder="ex: Chevrolet, Jean, Biper 12…"
                    placeholderTextColor="#94a3b8"
                    value={customerIdentifier}
                    onChangeText={setCustomerIdentifier}
                    autoCapitalize="characters"
                />
            </View>

            <View style={[styles.container, isTablet ? styles.rowLayout : styles.colLayout]}>
                <TouchableOpacity style={styles.box} onPress={() => selectLocation('sur_place')}>
                    <Text style={styles.text}>{t('location.eat_in')}</Text>
                    <MaterialIcons name="table-restaurant" size={isTablet ? 200 : 120} color="#0056b3" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.box} onPress={() => selectLocation('emporter')}>
                    <Text style={styles.text}>{t('location.takeaway')}</Text>
                    <MaterialIcons name="food-bank" size={isTablet ? 200 : 120} color="#0056b3" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.box, styles.boxDelivery]} onPress={() => selectLocation('livraison')}>
                    <Text style={styles.text}>Livraison</Text>
                    <MaterialIcons name="delivery-dining" size={isTablet ? 200 : 120} color="#f97316" />
                </TouchableOpacity>
            </View>

            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    main: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        paddingVertical: 30,
    },
    titleBox: {
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    title: {
        color: "#0056b3",
        fontSize: 38,
        fontWeight: "bold",
        textAlign: "center",
    },
    identifierBox: {
        width: "80%",
        marginBottom: 28,
    },
    identifierLabel: {
        fontSize: 16,
        color: "#64748b",
        fontWeight: "600",
        marginBottom: 10,
    },
    identifierInput: {
        borderWidth: 2,
        borderColor: "#cbd5e1",
        borderRadius: 14,
        paddingHorizontal: 20,
        paddingVertical: 14,
        fontSize: 20,
        color: "#0f172a",
        backgroundColor: "#f8fafc",
    },
    container: {
        width: "90%",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
    },
    rowLayout: { flexDirection: "row" },
    colLayout: { flexDirection: "column" },
    box: {
        width: isTablet ? "30%" : "70%",
        aspectRatio: 1,
        backgroundColor: "white",
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 2,
        borderColor: "#e2e8f0",
    },
    boxDelivery: {
        borderColor: "#fed7aa",
        backgroundColor: "#fff7ed",
    },
    text: {
        color: "black",
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 12,
        textAlign: "center",
    },
    errorContainer: {
        marginTop: 20,
        backgroundColor: '#ffebee',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorText: {
        color: '#c62828',
        fontSize: 16,
        fontWeight: '600',
    },
});
