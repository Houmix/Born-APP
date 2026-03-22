import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

const { width } = Dimensions.get('window');
const isTablet = width > 600;

const KEYBOARD_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
    ['U', 'V', 'W', 'X', 'Y', 'Z', '-', '.', ' ', '⌫'],
];

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

    const handleKey = (key: string) => {
        if (key === '⌫') {
            setCustomerIdentifier(prev => prev.slice(0, -1));
        } else {
            setCustomerIdentifier(prev => (prev.length < 30 ? prev + key : prev));
        }
    };

    const selectLocation = async (deliveryType: 'sur_place' | 'emporter') => {
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

            {/* Champ identifiant client + clavier alphanumérique */}
            <View style={styles.identifierBox}>
                <Text style={styles.identifierLabel}>Identifiant client (nom, table, téléphone…)</Text>

                {/* Affichage de la saisie */}
                <View style={styles.identifierDisplay}>
                    <Text style={[styles.identifierText, !customerIdentifier && styles.placeholder]}>
                        {customerIdentifier || 'ex: TABLE 5, Karim, 0550…'}
                    </Text>
                    {customerIdentifier.length > 0 && (
                        <TouchableOpacity onPress={() => setCustomerIdentifier('')} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Clavier */}
                <View style={styles.keyboard}>
                    {KEYBOARD_ROWS.map((row, ri) => (
                        <View key={ri} style={styles.keyRow}>
                            {row.map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.key, key === '⌫' && styles.keyBackspace]}
                                    onPress={() => handleKey(key)}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.keyText, key === '⌫' && styles.keyTextBackspace]}>
                                        {key === ' ' ? '␣' : key}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </View>
            </View>

            {/* Boutons sur place / emporter */}
            <View style={[styles.container, isTablet ? styles.rowLayout : styles.colLayout]}>
                <TouchableOpacity style={styles.box} onPress={() => selectLocation('sur_place')}>
                    <Text style={styles.text}>{t('location.eat_in')}</Text>
                    <MaterialIcons name="table-restaurant" size={isTablet ? 140 : 90} color="#0056b3" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.box} onPress={() => selectLocation('emporter')}>
                    <Text style={styles.text}>{t('location.takeaway')}</Text>
                    <MaterialIcons name="food-bank" size={isTablet ? 140 : 90} color="#0056b3" />
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
        paddingVertical: 20,
    },
    titleBox: {
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    title: {
        color: "#0056b3",
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
    },
    identifierBox: {
        width: "92%",
        marginBottom: 20,
    },
    identifierLabel: {
        fontSize: 14,
        color: "#64748b",
        fontWeight: "600",
        marginBottom: 8,
    },
    identifierDisplay: {
        borderWidth: 2,
        borderColor: "#0056b3",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#f8fafc",
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        marginBottom: 10,
    },
    identifierText: {
        flex: 1,
        fontSize: 20,
        color: "#0f172a",
        letterSpacing: 1,
        fontWeight: "600",
    },
    placeholder: {
        color: "#94a3b8",
        fontWeight: "400",
        fontSize: 16,
    },
    clearBtn: {
        padding: 6,
        marginLeft: 8,
    },
    clearBtnText: {
        fontSize: 18,
        color: "#94a3b8",
    },
    keyboard: {
        gap: 6,
    },
    keyRow: {
        flexDirection: "row",
        gap: 5,
    },
    key: {
        flex: 1,
        backgroundColor: "#e2e8f0",
        borderRadius: 8,
        paddingVertical: isTablet ? 12 : 9,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 30,
    },
    keyBackspace: {
        backgroundColor: "#fecaca",
        flex: 1,
    },
    keyText: {
        fontSize: isTablet ? 15 : 13,
        fontWeight: "700",
        color: "#1e293b",
    },
    keyTextBackspace: {
        color: "#dc2626",
    },
    container: {
        width: "90%",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
    },
    rowLayout: { flexDirection: "row" },
    colLayout: { flexDirection: "row" },
    box: {
        flex: 1,
        aspectRatio: 1.2,
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
    text: {
        color: "black",
        fontSize: isTablet ? 22 : 18,
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
    },
    errorContainer: {
        marginTop: 16,
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
