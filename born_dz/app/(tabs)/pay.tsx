import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

export default function PaymentScreen() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const theme = useKioskTheme();
    const [order, setOrder] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const loadOrder = async () => {
            const allKeys = await AsyncStorage.getAllKeys();
            const allItems = await AsyncStorage.multiGet(allKeys);
            console.log("Stored items in session:", allItems);
            try {
                const stored = await AsyncStorage.getItem("pendingOrder");
                if (stored) {
                    setOrder(JSON.parse(stored));
                } else {
                    setErrorMessage(t('errors.no_order'));
                }
            } catch (err) {
                setErrorMessage(t('errors.loading_data'));
            }
        };
        loadOrder();
    }, []);

    const processPayment = async (paymentMethod) => {
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            const Employee_id = await AsyncStorage.getItem("Employee_id");
            const restaurantId = getRestaurantId();
            const takeawayValue = await AsyncStorage.getItem("orderTakeaway");
            const isTakeaway = takeawayValue === "true";
            const deliveryType = await AsyncStorage.getItem("orderDeliveryType") || 'sur_place';
            const customerIdentifier = await AsyncStorage.getItem("orderCustomerIdentifier") || '';

            const dataToSend = {
                user: Employee_id,
                items: order,
                restaurant: parseInt(restaurantId || "0", 10),
                takeaway: isTakeaway,
                delivery_type: deliveryType,
                customer_identifier: customerIdentifier,
            };
            
            console.log("Données à envoyer :", dataToSend);
            const accessToken = await AsyncStorage.getItem("token");
            
            const response = await axios.post(
                `${getPosUrl()}/order/api/createOrder/${paymentMethod}/`,
                dataToSend,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.status === 200 || response.status === 201) {
                await AsyncStorage.multiRemove(["pendingOrder", "orderTakeaway", "orderDeliveryType", "orderCustomerIdentifier"]);
                await AsyncStorage.setItem("lastOrderId", response.data.order_id.toString());
                router.push("/confirmation");
            } else {
                setErrorMessage(t('errors.create_order'));
                Alert.alert(t('error'), t('errors.create_order'));
            }
        } catch (error) {
            console.error("Erreur lors de la création de la commande", error);
            setErrorMessage(t('errors.create_order'));
            Alert.alert(t('error'), t('errors.network'));
        } finally {
            setIsProcessing(false);
        }
    };

    const card = () => processPayment(1);
    const cash = () => processPayment(0);

    return (
        <View style={[styles.main, { backgroundColor: theme.backgroundColor }, isRTL && { direction: 'rtl' }]}>
            <View style={styles.titleBox}>
                <Text style={[styles.title, { color: theme.primaryColor }]}>{t('payment.title')}</Text>
            </View>

            <View style={styles.container}>
                <TouchableOpacity
                    style={[styles.box, { backgroundColor: theme.cardBgColor }, isProcessing && styles.boxDisabled]}
                    onPress={cash}
                    disabled={isProcessing}
                >
                    <Text style={[styles.text, { color: theme.textColor }]}>{t('payment.cash')}</Text>
                    <Ionicons name="cash-outline" size={250} color={isProcessing ? "#ccc" : theme.textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.box, { backgroundColor: theme.cardBgColor }, isProcessing && styles.boxDisabled]}
                    onPress={card}
                    disabled={isProcessing}
                >
                    <Text style={[styles.text, { color: theme.textColor }]}>{t('payment.card')}</Text>
                    <AntDesign name="creditcard" size={250} color={isProcessing ? "#ccc" : theme.textColor} />
                </TouchableOpacity>
            </View>

            {isProcessing && (
                <View style={styles.processingContainer}>
                    <Text style={styles.processingText}>{t('payment.processing')}</Text>
                </View>
            )}

            {errorMessage && !isProcessing ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
        </View>
    );
}

// Détection simple pour tablette vs mobile
const { width } = Dimensions.get('window');
const isTablet = width > 600;

const styles = StyleSheet.create({
    main: {
        flex: 1,
        flexDirection: 'column',
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
    },
    titleBox: {
        height: "20%",
        flexDirection: "row",
        display: "flex",
        justifyContent: "center",
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    container: {
        flexDirection: isTablet ? "row" : "column",
        height: "50%",
        width: "85%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        backgroundColor: "white",
    },
    box: {
        width: isTablet ? "45%" : "90%",
        height: "90%",
        backgroundColor: "white",
        borderRadius: 15,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    boxDisabled: {
        opacity: 0.5,
    },
    title: {
        fontSize: 38,
        fontWeight: "bold",
        textAlign: "center",
    },
    text: {
        color: "black",
        fontSize: 36,
        fontWeight: "bold",
        textDecorationLine: "none",
        marginBottom: 20,
    },
    processingContainer: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#e3f2fd',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2196f3',
    },
    processingText: {
        color: '#1976d2',
        fontSize: 16,
        fontWeight: '600',
    },
    errorContainer: {
        position: 'absolute',
        bottom: 40,
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