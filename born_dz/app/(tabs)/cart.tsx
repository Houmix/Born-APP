import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, Dimensions, Modal, Image, ScrollView, ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKioskTheme } from "@/contexts/KioskThemeContext";
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";

const { width } = Dimensions.get("window");

const COLORS = {
  success: "#22C55E",
  danger: "#EF4444",
  muted: "#64748B",
  text: "#1E293B",
};

export default function CartPage() {
  const [orderList, setOrderList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [crossSellItems, setCrossSellItems] = useState<any[]>([]);
  const [showCrossSell, setShowCrossSell] = useState(false);
  const [crossSellQty, setCrossSellQty] = useState<Record<number, number>>({});

  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const theme = useKioskTheme();

  useEffect(() => {
    fetchCart();
    fetchCrossSellItems();
  }, []);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem("orderList");
      if (stored) setOrderList(JSON.parse(stored));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCrossSellItems = async () => {
    try {
      const restaurantId = getRestaurantId();
      if (!restaurantId) return;
      const res = await axios.get(`${getPosUrl()}/menu/api/crosssell/?restaurant_id=${restaurantId}`, { timeout: 4000 });
      setCrossSellItems(res.data || []);
    } catch (e) {
      console.warn("Cross-sell fetch error:", e);
    }
  };

  const updateCart = async (newList: any[]) => {
    setOrderList(newList);
    await AsyncStorage.setItem("orderList", JSON.stringify(newList));
  };

  const changeQuantity = (index: number, delta: number) => {
    const item = orderList[index];
    // Les récompenses sont à quantité fixe 1 — seule la suppression est permise
    if (item?.isReward && delta > 0) return;
    const newList = [...orderList];
    const newQty = newList[index].quantity + delta;
    if (newQty > 0) {
      newList[index].quantity = newQty;
      updateCart(newList);
    } else {
      removeMenu(index);
    }
  };

  const removeMenu = async (index: number) => {
    const item = orderList[index];
    // Si c'est une récompense, la retirer aussi de pendingRewards
    if (item?.isReward) {
      try {
        const raw = await AsyncStorage.getItem("pendingRewards");
        if (raw) {
          const pending = JSON.parse(raw).filter((r: any) => r.rewardId !== item.rewardId);
          await AsyncStorage.setItem("pendingRewards", JSON.stringify(pending));
        }
      } catch {}
    }
    const newList = orderList.filter((_, i) => i !== index);
    updateCart(newList);
  };

  const calculateMenuPrice = (menu: any) => {
    const base = parseFloat(menu.price) || 0;
    const extras = menu.steps?.reduce((sum: number, step: any) =>
      sum + step.selectedOptions.reduce((optSum: number, opt: any) => optSum + (parseFloat(opt.optionPrice) || 0), 0)
    , 0) || 0;
    return base + extras;
  };

  const totalPrice = useMemo(() => {
    return orderList.reduce((acc, item) => acc + (calculateMenuPrice(item) * item.quantity), 0);
  }, [orderList]);

  const handleValidatePress = () => {
    if (crossSellItems.length > 0) {
      setCrossSellQty({});
      setShowCrossSell(true);
    } else {
      proceedToPayment(orderList);
    }
  };

  const adjustCrossSellQty = (id: number, delta: number) => {
    setCrossSellQty(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleCrossSellConfirm = async () => {
    const newItems = Object.entries(crossSellQty)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = crossSellItems.find(i => i.id === parseInt(id));
        return {
          menuId: item.id,
          menuName: item.name,
          price: parseFloat(item.price),
          quantity: qty,
          extra: true,
          solo: false,
          steps: [],
        };
      });

    const updatedList = [...orderList, ...newItems];
    await updateCart(updatedList);
    setShowCrossSell(false);
    proceedToPayment(updatedList);
  };

  const proceedToPayment = async (list: any[]) => {
    // Exclure les articles de récompense (prix 0 DA, gérés séparément au paiement)
    const formattedOrder = list
      .filter(order => !order.isReward)
      .map(order => ({
        menu: order.menuId,
        quantity: order.quantity,
        solo: order.solo === true,
        extra: order.extra === true,
        options: order.steps?.flatMap((s: any) => s.selectedOptions.map((o: any) => ({ step: s.stepId, option: o.optionId }))) || [],
      }));
    await AsyncStorage.setItem("pendingOrder", JSON.stringify(formattedOrder));
    router.push("/location");
  };

  if (orderList.length === 0 && !isLoading) {
    return (
      <View style={[styles.emptyContainer, isRTL && { direction: 'rtl' }]}>
        <Ionicons name="cart-outline" size={100} color={COLORS.muted} />
        <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
        <Text style={styles.emptyMessage}>{t('cart.empty_message')}</Text>
        <TouchableOpacity style={[styles.startOrderButton, { backgroundColor: theme.primaryColor }]} onPress={() => router.push("/terminal")}>
          <Text style={styles.startOrderText}>{t('cart.start_order')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.backgroundColor }, isRTL && { direction: 'rtl' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/terminal")}>
          <AntDesign name={isRTL ? "arrowright" : "arrowleft"} size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cart.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={orderList}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[
            styles.cartItem,
            { backgroundColor: item.isReward ? '#FFF7ED' : theme.cardBgColor },
            item.isReward && { borderWidth: 1.5, borderColor: '#F97316' },
          ]}>
            <View style={styles.itemHeader}>
              <View style={{flex: 1}}>
                <Text style={[styles.itemName, { color: item.isReward ? '#C2410C' : theme.textColor }]}>
                  {item.menuName}
                </Text>
                {item.isReward ? (
                  <Text style={{ fontSize: 13, color: '#9A3412', marginTop: 2 }}>
                    ⭐ {item.pointsCost} pts utilisés — Offert
                  </Text>
                ) : (
                  <Text style={styles.itemPriceUnit}>
                    {calculateMenuPrice(item)} DA {t('cart.unit_price')}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => removeMenu(index)} style={styles.deleteIcon}>
                <Feather name="trash-2" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>

            {!item.isReward && (
              <View style={styles.optionsList}>
                {item.steps?.map((step: any, i: number) => (
                  <View key={i} style={styles.stepRow}>
                    <Text style={styles.stepName}>{step.stepName} : </Text>
                    <Text style={[styles.optionNames, { color: theme.textColor }]}>
                      {step.selectedOptions.map((o: any) => o.optionName).join(", ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.itemFooter}>
              {item.isReward ? (
                <Text style={{ fontSize: 13, color: '#9A3412', fontStyle: 'italic' }}>
                  Retirez de votre panier pour annuler
                </Text>
              ) : (
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, -1)}>
                    <AntDesign name="minus" size={20} color={theme.textColor} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, { color: theme.textColor }]}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, 1)}>
                    <AntDesign name="plus" size={20} color={theme.textColor} />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[styles.itemTotalPrice, { color: item.isReward ? '#F97316' : theme.primaryColor }]}>
                {item.isReward ? '0 DA' : `${(calculateMenuPrice(item) * item.quantity).toLocaleString()} DA`}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footerCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('cart.total')}</Text>
          <Text style={[styles.totalAmount, { color: theme.textColor }]}>{totalPrice.toLocaleString()} DA</Text>
        </View>
        <TouchableOpacity style={[styles.payButton, { backgroundColor: COLORS.success }]} onPress={handleValidatePress}>
          <Text style={styles.payButtonText}>{t('cart.validate')}</Text>
          <AntDesign name={isRTL ? "arrowleft" : "arrowright"} size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* MODAL CROSS-SELL */}
      <Modal visible={showCrossSell} transparent animationType="slide" onRequestClose={() => setShowCrossSell(false)}>
        <View style={csStyles.overlay}>
          <View style={csStyles.sheet}>
            <Text style={[csStyles.title, { color: theme.primaryColor }]}>Et avec ça ?</Text>
            <Text style={csStyles.subtitle}>Ajoutez quelque chose à votre commande</Text>

            <ScrollView contentContainerStyle={csStyles.itemsGrid} showsVerticalScrollIndicator={false}>
              {crossSellItems.map(item => {
                const qty = crossSellQty[item.id] || 0;
                return (
                  <View key={item.id} style={[csStyles.card, { backgroundColor: theme.cardBgColor }]}>
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={csStyles.itemImage} resizeMode="contain" />
                    ) : (
                      <View style={[csStyles.itemImage, csStyles.imagePlaceholder]}>
                        <Ionicons name="fast-food" size={40} color={theme.categoryTextColor} />
                      </View>
                    )}
                    <Text style={[csStyles.itemName, { color: theme.textColor }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={[csStyles.itemPrice, { color: theme.primaryColor }]}>{item.price} DA</Text>

                    <View style={csStyles.qtyRow}>
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={[csStyles.addBtn, { backgroundColor: theme.primaryColor }]}
                          onPress={() => adjustCrossSellQty(item.id, 1)}
                        >
                          <AntDesign name="plus" size={20} color="white" />
                        </TouchableOpacity>
                      ) : (
                        <View style={csStyles.qtyControls}>
                          <TouchableOpacity style={csStyles.qtyBtn} onPress={() => adjustCrossSellQty(item.id, -1)}>
                            <AntDesign name="minus" size={18} color={theme.textColor} />
                          </TouchableOpacity>
                          <Text style={[csStyles.qtyValue, { color: theme.textColor }]}>{qty}</Text>
                          <TouchableOpacity style={csStyles.qtyBtn} onPress={() => adjustCrossSellQty(item.id, 1)}>
                            <AntDesign name="plus" size={18} color={theme.textColor} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={csStyles.footer}>
              <TouchableOpacity style={csStyles.skipBtn} onPress={() => { setShowCrossSell(false); proceedToPayment(orderList); }}>
                <Text style={csStyles.skipText}>Non merci</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[csStyles.confirmBtn, { backgroundColor: COLORS.success }]}
                onPress={handleCrossSellConfirm}
              >
                <Text style={csStyles.confirmText}>
                  {Object.values(crossSellQty).some(q => q > 0) ? 'Ajouter et continuer' : 'Continuer sans ajouter'}
                </Text>
                <AntDesign name="arrowright" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, backgroundColor: 'white',
  },
  backButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  listContent: { padding: 16 },
  cartItem: {
    borderRadius: 20, padding: 20, marginBottom: 15,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 20, fontWeight: '700' },
  itemPriceUnit: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  deleteIcon: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  optionsList: { marginVertical: 15, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#E2E8F0' },
  stepRow: { flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' },
  stepName: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  optionNames: { fontSize: 13, flex: 1 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  qtyBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 18, fontWeight: '700', marginHorizontal: 15 },
  itemTotalPrice: { fontSize: 20, fontWeight: '800' },
  footerCard: {
    backgroundColor: 'white', padding: 25,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 16, color: COLORS.muted, fontWeight: '600' },
  totalAmount: { fontSize: 28, fontWeight: '900' },
  payButton: {
    height: 70, borderRadius: 20, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  payButtonText: { color: 'white', fontSize: 22, fontWeight: '800' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.muted, marginTop: 20, textAlign: 'center' },
  emptyMessage: { fontSize: 16, color: COLORS.muted, marginTop: 10, textAlign: 'center' },
  startOrderButton: { marginTop: 30, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15 },
  startOrderText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

const csStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40,
    paddingTop: 30, paddingHorizontal: 25, paddingBottom: 40,
    maxHeight: '85%',
  },
  title: { fontSize: 34, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 17, color: COLORS.muted, textAlign: 'center', marginBottom: 25 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingBottom: 10 },
  card: {
    width: (width - 85) / 3,
    borderRadius: 20, padding: 15, alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  itemImage: { width: '100%', height: 100, borderRadius: 12, marginBottom: 10, backgroundColor: 'white' },
  imagePlaceholder: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  qtyRow: { width: '100%', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 2 },
  qtyBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 16, fontWeight: '700', marginHorizontal: 10 },
  footer: { flexDirection: 'row', gap: 15, marginTop: 20 },
  skipBtn: {
    flex: 1, height: 65, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  skipText: { fontSize: 17, fontWeight: '700', color: COLORS.muted },
  confirmBtn: {
    flex: 2, height: 65, borderRadius: 18, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  confirmText: { fontSize: 17, fontWeight: '800', color: 'white' },
});
