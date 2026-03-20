import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  PanResponder,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import { getPosUrl, buildPhotoUri } from "@/utils/serverConfig";
import Feather from '@expo/vector-icons/Feather';
import { useBorneSync } from "@/hooks/useBorneSync.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useKioskTheme } from "@/contexts/KioskThemeContext";

export default function MenuScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const theme = useKioskTheme();

  // États des données
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  // États des Modales
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isInactivityModalVisible, setIsInactivityModalVisible] = useState(false);

  // Hook de synchronisation
  const { categories, menus, isLoading } = useBorneSync();

  // Variables de Timer
  const mainTimerRef = useRef(null);
  const secondaryTimerRef = useRef(null);

  // --- CALCULS DE LAYOUT ---
  const width = Dimensions.get("window").width;
  const itemMargin = width > 700 ? 20 : 10;
  const numColumns = width >= 700 ? 3 : width >= 500 ? 2 : 1;
  const sidebarPercent = width > 700 ? 25 : 30;
  const sidebarWidth = `${sidebarPercent}%`;
  const menuGridWidth = 100 - sidebarPercent;
  const innerGridWidth = (width * menuGridWidth / 100);
  const itemWidth = (innerGridWidth - itemMargin * (numColumns + 1)) / numColumns;

  // --- GESTION DU TIMER D'INACTIVITÉ (30s) ---
  const resetMainTimer = useCallback(() => {
    if (isInactivityModalVisible) return;
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    mainTimerRef.current = setTimeout(() => {
      setIsInactivityModalVisible(true);
    }, 30000);
  }, [isInactivityModalVisible]);

  // ⚡ DÉTECTION GLOBALE D'ACTIVITÉ (PAN RESPONDER)
  const resetTimerRef = useRef(resetMainTimer);
  useEffect(() => { resetTimerRef.current = resetMainTimer; }, [resetMainTimer]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetTimerRef.current();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetTimerRef.current();
        return false;
      },
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      resetMainTimer();
      return () => {
        if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
        if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
      };
    }, [resetMainTimer])
  );

  // --- TIMER SECONDAIRE (10s après l'affichage de la modale d'inactivité) ---
  useEffect(() => {
    if (isInactivityModalVisible) {
      secondaryTimerRef.current = setTimeout(() => {
        handleCancelOrder();
      }, 10000);
    } else {
      if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
    }
    return () => {
      if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
    };
  }, [isInactivityModalVisible]);

  // Annuler la commande → retour à l'accueil (screensaver)
  const handleCancelOrder = async () => {
    try {
      await AsyncStorage.multiRemove(["orderList", "pendingOrder"]);
      setIsInactivityModalVisible(false);
      router.replace("/");
    } catch (e) {
      console.error("Erreur nettoyage", e);
    }
  };

  const handleContinueOrder = () => {
    setIsInactivityModalVisible(false);
    resetMainTimer();
  };

  // --- LOGIQUE PANIER ---
  const updateCartCount = async () => {
    try {
      const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
      const count = existingOrders.reduce((total, item) => total + (item.quantity || 1), 0);
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    updateCartCount();
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories]);

  // ── Composition modal ──────────────────────────────────────────────
  const [compVisible, setCompVisible] = useState(false);
  const [compItem, setCompItem] = useState(null);
  const [compIsSolo, setCompIsSolo] = useState(false);
  const [compSteps, setCompSteps] = useState([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compSelected, setCompSelected] = useState({});

  const { getStepsForMenu } = useBorneSync();

  const openCompositionModal = async (item, isSolo) => {
    setCompItem(item);
    setCompIsSolo(isSolo);
    setCompSelected({});
    setCompSteps([]);
    setCompVisible(true);
    setCompLoading(true);
    resetMainTimer();
    try {
      const data = await getStepsForMenu(item.id, isSolo ? 'solo' : 'full');
      setCompSteps(data || []);
    } catch { setCompSteps([]); }
    finally { setCompLoading(false); }
  };

  const compToggleOption = (stepId, optionId, maxOptions) => {
    setCompSelected(prev => {
      const current = prev[stepId] || [];
      if (maxOptions === 1) return { ...prev, [stepId]: [optionId] };
      if (current.includes(optionId)) return { ...prev, [stepId]: current.filter(id => id !== optionId) };
      if (maxOptions && current.length >= maxOptions) return prev;
      return { ...prev, [stepId]: [...current, optionId] };
    });
  };

  const compBasePrice = parseFloat(
    compIsSolo ? (compItem?.solo_price || compItem?.price || 0) : (compItem?.price || 0)
  );

  const compTotalPrice = useMemo(() => {
    let extras = 0;
    compSteps.forEach(step => {
      const sel = compSelected[step.id] || [];
      step.stepoptions?.forEach(opt => {
        if (sel.includes(opt.id)) extras += parseFloat(opt.option?.extra_price || 0);
      });
    });
    return compBasePrice + extras;
  }, [compSelected, compSteps, compBasePrice]);

  const compIsComplete = compSteps.length === 0 || compSteps.every(s => (compSelected[s.id]?.length || 0) > 0);
  const compDoneCount = compSteps.filter(s => (compSelected[s.id]?.length || 0) > 0).length;

  const addOrderToCart = async (newOrder) => {
    const existing = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
    const areOptionsEqual = (s1, s2) => {
      if (!s1 && !s2) return true;
      if (!s1 || !s2 || s1.length !== s2.length) return false;
      for (const step1 of s1) {
        const step2 = s2.find(s => s.stepId === step1.stepId);
        if (!step2) return false;
        const o1 = step1.selectedOptions.map(o => o.optionId).sort();
        const o2 = step2.selectedOptions.map(o => o.optionId).sort();
        if (o1.length !== o2.length || !o1.every((v, i) => v === o2[i])) return false;
      }
      return true;
    };
    const idx = existing.findIndex(item =>
      item.menuId === newOrder.menuId && item.solo === newOrder.solo &&
      item.extra === newOrder.extra && areOptionsEqual(item.steps, newOrder.steps)
    );
    if (idx >= 0) existing[idx].quantity += 1;
    else existing.push(newOrder);
    await AsyncStorage.setItem("orderList", JSON.stringify(existing));
  };

  const handleCompConfirm = async () => {
    if (!compItem) return;
    const order = {
      menuName: compIsSolo ? `${compItem.name} (Solo)` : compItem.name,
      menuId: compItem.id,
      price: compTotalPrice,
      quantity: 1,
      solo: compIsSolo,
      extra: false,
      steps: compSteps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        selectedOptions: step.stepoptions
          .filter(opt => compSelected[step.id]?.includes(opt.id))
          .map(opt => ({
            optionId: opt.id,
            option: opt.id,
            optionName: opt.option.name,
            optionPrice: opt.option.extra_price,
          })),
      })),
    };
    await addOrderToCart(order);
    setCompVisible(false);
    await updateCartCount();
    resetMainTimer();
  };

  const handleOpenModal = (item) => {
    setSelectedItemForModal(item);
    setIsModalVisible(true);
  };

  const handleSoloAdd = () => {
    if (!selectedItemForModal) return;
    const item = selectedItemForModal;
    setIsModalVisible(false);
    if (theme.compositionMode === 'modal') {
      openCompositionModal(item, true);
    } else {
      resetMainTimer();
      router.push({ pathname: "/step", params: { menuId: item.id, menuName: item.name, price: item.solo_price || item.price || 0, isSolo: 'true' } });
    }
  };

  const handleMenuAdd = () => {
    if (!selectedItemForModal) return;
    const item = selectedItemForModal;
    setIsModalVisible(false);
    if (theme.compositionMode === 'modal') {
      openCompositionModal(item, false);
    } else {
      resetMainTimer();
      router.push({ pathname: "/step", params: { menuId: item.id, menuName: item.name, price: item.price || 0, isSolo: 'false' } });
    }
  };

  const handleAddToCart = async (item) => {
    if (item.extra) {
      try {
        const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
        const existingIndex = existingOrders.findIndex(order => order.menuId === item.id && order.extra === true);
        if (existingIndex !== -1) existingOrders[existingIndex].quantity += 1;
        else existingOrders.push({ menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0, steps: [] });
        await AsyncStorage.setItem("orderList", JSON.stringify(existingOrders));
        await updateCartCount();
        resetMainTimer();
      } catch (error) { console.error('Erreur ajout extra:', error); }
    } else if (item.offer_menu_choice === false) {
      if (theme.compositionMode === 'modal') openCompositionModal(item, false);
      else { resetMainTimer(); router.push({ pathname: "/step", params: { menuId: item.id, menuName: item.name, price: item.solo_price || item.price || 0, isSolo: 'false' } }); }
    } else {
      handleOpenModal(item);
    }
  };

  // --- MODALE CHOIX PRODUIT (design enrichi avec image + description) ---
  const ChoiceModal = () => {
    if (!selectedItemForModal) return null;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={modalStyles.centeredView}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={modalStyles.productCard}>
            {selectedItemForModal.photo && (
              <Image
                source={{ uri: `${getPosUrl()}${selectedItemForModal.photo}` }}
                style={modalStyles.productImageFull}
                resizeMode="cover"
              />
            )}

            <View style={modalStyles.productDetails}>
              <Text style={modalStyles.modalTitle}>{selectedItemForModal.name}</Text>

              <View style={modalStyles.descriptionSection}>
                <Text style={modalStyles.descriptionText}>
                  {selectedItemForModal.description ||
                    "Délicieuse préparation artisanale avec des produits frais sélectionnés avec soin."}
                </Text>
              </View>

              <View style={modalStyles.footerActions}>
                <TouchableOpacity
                  style={modalStyles.backButton}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Feather name="arrow-left" size={20} color="#94a3b8" />
                  <Text style={modalStyles.backButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>

                <View style={modalStyles.mainButtons}>
                  <TouchableOpacity
                    style={[modalStyles.actionBtn, modalStyles.btnSolo]}
                    onPress={handleSoloAdd}
                  >
                    <Text style={modalStyles.btnLabel}>{t('terminal.solo')}</Text>
                    <Text style={modalStyles.btnPrice}>
                      {selectedItemForModal.solo_price || selectedItemForModal.price || 0} DA
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[modalStyles.actionBtn, { backgroundColor: theme.primaryColor }]}
                    onPress={handleMenuAdd}
                  >
                    <Text style={[modalStyles.btnLabel, { color: 'white' }]}>
                      {t('terminal.in_menu')}
                    </Text>
                    <Text style={modalStyles.btnSubtitle}>
                      {selectedItemForModal.price || 0} DA
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // --- MODALE D'INACTIVITÉ ---
  const InactivityModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isInactivityModalVisible}
      onRequestClose={() => {}}
    >
      <View style={modalStyles.centeredView}>
        <View style={modalStyles.alertView}>
          <Text style={[modalStyles.alertTitle, { color: theme.primaryColor }]}>
            Toujours là ?
          </Text>
          <Text style={modalStyles.alertMessage}>
            Votre session va expirer dans 10 secondes...
          </Text>
          <TouchableOpacity
            style={[modalStyles.alertButtonContinue, { backgroundColor: theme.primaryColor }]}
            onPress={handleContinueOrder}
          >
            <Text style={modalStyles.alertButtonTextWhite}>Continuer ma commande</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.alertButtonCancel} onPress={handleCancelOrder}>
            <Text style={modalStyles.alertButtonTextRed}>Annuler et quitter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>{t('terminal.loading_menus')}</Text>
      </View>
    );
  }

  const filteredMenus = menus.filter(
    (item) =>
      item.group_menu === selectedCategory?.id &&
      item.avalaible &&
      categories.some((category) => category.id === item.group_menu && category.avalaible)
  );

  const getDisplayPrice = (item) => {
    if (item.extra == 1) return `+${item.solo_price}`;
    if (item.price && parseFloat(item.price) > 0) return `${item.price}`;
    return `${item.solo_price}`;
  };

  const renderMenuCard = (item) => {
    const imageSource = item.photo
      ? { uri: buildPhotoUri(item.photo)! }
      : require('@/assets/logo.png');
    const displayPrice = getDisplayPrice(item);
    const style = theme.cardStyle || 'gradient';

    if (style === 'macdo') {
      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.menuItem, { width: itemWidth, margin: itemMargin / 2, backgroundColor: theme.cardBgColor }]}
          onPress={() => handleAddToCart(item)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 6, overflow: 'hidden' }}>
            <Image source={imageSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <View style={{ flex: 4, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, justifyContent: 'space-between', backgroundColor: theme.cardBgColor }}>
            <Text style={{ color: theme.textColor, fontWeight: '700', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{item.name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.secondaryColor, fontSize: 16, fontWeight: '900' }}>{displayPrice} DA</Text>
              <View style={[styles.addButton, { backgroundColor: theme.secondaryColor }]}>
                <Feather name="plus" size={18} color="white" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (style === 'magazine') {
      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.menuItem, { width: itemWidth, margin: itemMargin / 2 }]}
          onPress={() => handleAddToCart(item)}
          activeOpacity={0.85}
        >
          <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={{ position: 'absolute', top: 12, left: 10, right: 10, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={{ position: 'absolute', bottom: 12, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ backgroundColor: theme.secondaryColor, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14 }}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>{displayPrice} DA</Text>
            </View>
            <View style={{ backgroundColor: 'white', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
              <Feather name="plus" size={20} color={theme.primaryColor} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // gradient (défaut)
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.menuItem, { width: itemWidth, margin: itemMargin / 2 }]}
        onPress={() => handleAddToCart(item)}
        activeOpacity={0.85}
      >
        <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.menuOverlay}>
          <Text style={styles.menuText} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceActionContainer}>
            <Text style={[styles.menuPrice, { color: theme.secondaryColor }]}>{displayPrice} DA</Text>
            <View style={[styles.addButton, { backgroundColor: theme.secondaryColor }]}>
              <Feather name="plus" size={20} color="white" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }, isRTL && { direction: 'rtl' }]} {...panResponder.panHandlers}>

      {/* HEADER AVEC DÉGRADÉ (couleurs personnalisables) */}
      <LinearGradient
        colors={[theme.primaryColor, theme.primaryColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        {theme.logoUrl ? (
          <Image source={{ uri: theme.logoUrl }} style={styles.logoImage} resizeMode="contain" />
        ) : (
          <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        )}
        <View style={styles.headerRight}>
          <LanguageSelector />
          <TouchableOpacity style={styles.cartButton} onPress={() => router.push("/cart")}>
            <Feather name="shopping-cart" size={35} color="white" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Contenu principal */}
      <View style={styles.content}>

        {/* Sidebar catégories */}
        <ScrollView
          style={[styles.sidebar, { width: sidebarWidth, backgroundColor: theme.sidebarColor }]}
          contentContainerStyle={styles.sidebarContent}
        >
          {categories.filter((category) => category.avalaible).map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                { backgroundColor: selectedCategory?.id === category.id ? theme.selectedCategoryBgColor : theme.categoryBgColor },
                selectedCategory?.id === category.id && { borderLeftWidth: 4, borderColor: theme.secondaryColor },
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              {category.photo && (
                <Image
                  source={{ uri: buildPhotoUri(category.photo)! }}
                  style={styles.categoryImage}
                />
              )}
              <Text style={[
                styles.categoryText,
                { color: selectedCategory?.id === category.id ? theme.secondaryColor : theme.categoryTextColor },
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grille des menus */}
        <View style={[styles.menuGridContainer, { width: `${menuGridWidth}%` }]}>
          {filteredMenus.length === 0 ? (
            <View style={styles.emptyGrid}>
              <Text style={styles.emptyGridText}>{t('terminal.no_products')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMenus}
              numColumns={numColumns}
              key={numColumns}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => renderMenuCard(item)}
              contentContainerStyle={styles.menuGrid}
            />
          )}
        </View>
      </View>

      <ChoiceModal />
      <InactivityModal />

      {/* ── MODAL COMPOSITION ──────────────────────────────────────── */}
      <Modal animationType="fade" transparent visible={compVisible} onRequestClose={() => setCompVisible(false)}>
        <View style={compStyles.overlay}>
          <View style={compStyles.card}>
            <View style={[compStyles.header, { backgroundColor: theme.primaryColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={compStyles.headerTitle} numberOfLines={1}>
                  {compIsSolo ? `${compItem?.name} (Solo)` : compItem?.name}
                </Text>
                <Text style={compStyles.headerSub}>{compDoneCount}/{compSteps.length} étape{compSteps.length > 1 ? 's' : ''} complète{compSteps.length > 1 ? 's' : ''}</Text>
              </View>
              <View style={compStyles.priceBadge}>
                <Text style={[compStyles.priceText, { color: theme.primaryColor }]}>{compTotalPrice.toFixed(0)} DA</Text>
              </View>
              <TouchableOpacity onPress={() => setCompVisible(false)} style={compStyles.closeBtn}>
                <Feather name="x" size={22} color="white" />
              </TouchableOpacity>
            </View>

            {compSteps.length > 0 && (
              <View style={compStyles.progressRow}>
                {compSteps.map((s, i) => (
                  <View key={i} style={[compStyles.progressSeg, { backgroundColor: (compSelected[s.id]?.length || 0) > 0 ? theme.primaryColor : '#E2E8F0' }]} />
                ))}
              </View>
            )}

            {compLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primaryColor} />
                <Text style={{ color: '#64748B', marginTop: 16, fontSize: 18 }}>Chargement des options...</Text>
              </View>
            ) : compSteps.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 18 }}>Aucune option à configurer</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 32 }} showsVerticalScrollIndicator={false}>
                {compSteps.map((step) => {
                  const isDone = (compSelected[step.id]?.length || 0) > 0;
                  return (
                    <View key={step.id}>
                      <View style={compStyles.stepHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={compStyles.stepName}>{step.name}</Text>
                          <Text style={compStyles.stepHint}>{step.max_options === 1 ? 'Choisissez une option' : `Jusqu'à ${step.max_options} options`}</Text>
                        </View>
                        {isDone && <Feather name="check-circle" size={26} color="#22C55E" />}
                      </View>
                      <View style={compStyles.optionsGrid}>
                        {step.stepoptions?.map((opt) => {
                          const isSelected = compSelected[step.id]?.includes(opt.id);
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[compStyles.optCard, isSelected && { borderColor: theme.primaryColor, backgroundColor: theme.primaryColor + '15' }]}
                              onPress={() => compToggleOption(step.id, opt.id, step.max_options)}
                              activeOpacity={0.8}
                            >
                              {isSelected && <View style={compStyles.checkBadge}><Feather name="check-circle" size={22} color={theme.primaryColor} /></View>}
                              {opt.option?.photo
                                ? <Image source={{ uri: buildPhotoUri(opt.option.photo)! }} style={compStyles.optImage} resizeMode="contain" />
                                : <View style={[compStyles.optImage, { backgroundColor: '#F1F5F9', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}><Feather name="package" size={36} color="#94a3b8" /></View>
                              }
                              <Text style={[compStyles.optName, { color: theme.textColor }]} numberOfLines={2}>{opt.option?.name}</Text>
                              {opt.option?.extra_price > 0 && <Text style={[compStyles.optExtra, { color: theme.secondaryColor }]}>+{opt.option.extra_price} DA</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={compStyles.footer}>
              <TouchableOpacity
                style={[compStyles.addBtn, { backgroundColor: compIsComplete ? '#22C55E' : '#CBD5E1' }]}
                onPress={handleCompConfirm}
                disabled={!compIsComplete}
              >
                <Feather name="shopping-cart" size={24} color="white" />
                <Text style={compStyles.addBtnText}>
                  {compIsComplete ? `Ajouter au panier — ${compTotalPrice.toFixed(0)} DA` : `Complétez toutes les étapes (${compDoneCount}/${compSteps.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  logoImage: { width: 220, height: 80 },
  container: { flex: 1, backgroundColor: "#F8F9FA" },   // surchargé inline
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 24, textAlign: "center", marginTop: 20, fontWeight: '600' },

  header: {
    height: 90,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 25, elevation: 6, shadowColor: "#000", zIndex: 100,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  cartButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  cartBadge: {
    position: 'absolute', right: -6, top: -6, backgroundColor: 'red', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  cartBadgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  content: { flex: 1, flexDirection: "row" },

  sidebar: { elevation: 5 },
  sidebarContent: { paddingVertical: 20, alignItems: "center" },
  categoryButton: {
    borderRadius: 10, padding: 10, width: "85%", marginBottom: 5, alignItems: "center",
    backgroundColor: "transparent", minHeight: 90, justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: "#334155", borderLeftWidth: 4,
  },
  selectedCategoryText: { fontWeight: '700' },
  categoryImage: { width: "100%", height: 130, marginBottom: 10, borderRadius: 10, backgroundColor: 'white' },
  categoryText: { fontSize: 15, fontWeight: "600", textAlign: "center" },

  menuGridContainer: { padding: 15 },
  menuGrid: { justifyContent: "flex-start", alignItems: "flex-start" },
  menuItem: {
    aspectRatio: 0.72, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#1e293b',
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12,
    elevation: 6, marginBottom: 16,
  },
  menuOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 40,
  },
  menuText: {
    color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  priceActionContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuPrice: { fontSize: 16, fontWeight: '900' },
  addButton: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
  },
  emptyGrid: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyGridText: { fontSize: 20, color: '#94a3b8', textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  // Modale choix produit (design enrichi - image + description)
  productCard: {
    backgroundColor: "white", borderRadius: 30, width: '75%', maxWidth: 800,
    overflow: 'hidden', elevation: 20, shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
  },
  productImageFull: { width: '100%', height: 300 },
  productDetails: { padding: 30 },
  modalTitle: { fontSize: 36, fontWeight: "900", color: '#1e293b', marginBottom: 15 },
  descriptionSection: { marginBottom: 40 },
  descriptionText: { fontSize: 18, color: '#64748b', lineHeight: 26 },
  footerActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 25,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  backButtonText: { fontSize: 18, color: '#94a3b8', fontWeight: '600' },
  mainButtons: { flexDirection: 'row', gap: 15 },
  actionBtn: {
    paddingVertical: 15, paddingHorizontal: 25, borderRadius: 18, minWidth: 160, alignItems: 'center',
  },
  btnSolo: { backgroundColor: '#f1f5f9' },
  btnLabel: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  btnPrice: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  btnSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // Modale inactivité
  alertView: {
    width: 420, backgroundColor: "white", borderRadius: 25,
    padding: 35, alignItems: "center", elevation: 20,
  },
  alertTitle: { fontSize: 28, fontWeight: "800", marginBottom: 12 },
  alertMessage: { fontSize: 16, color: "#475569", marginBottom: 30, textAlign: 'center', lineHeight: 24 },
  alertButtonContinue: {
    paddingVertical: 16, borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 12,
  },
  alertButtonCancel: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  alertButtonTextWhite: { color: "white", fontSize: 18, fontWeight: "bold" },
  alertButtonTextRed: { color: "#ef4444", fontSize: 16, fontWeight: "bold" },
});

const compStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  card: { width: "85%", maxWidth: 900, height: "88%", backgroundColor: "white", borderRadius: 30, overflow: "hidden", flexDirection: "column", elevation: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 28, paddingVertical: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "white" },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  priceBadge: { backgroundColor: "white", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 8 },
  priceText: { fontWeight: "900", fontSize: 18 },
  closeBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12 },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F8FAFC" },
  progressSeg: { flex: 1, height: 5, borderRadius: 3 },
  stepHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stepName: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  stepHint: { fontSize: 14, color: "#64748B", marginTop: 3 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  optCard: { width: "21%", minWidth: 130, borderRadius: 18, padding: 14, alignItems: "center", borderWidth: 2, borderColor: "#E2E8F0", backgroundColor: "white", elevation: 3 },
  checkBadge: { position: "absolute", top: 8, right: 8 },
  optImage: { width: 80, height: 80, marginBottom: 10 },
  optName: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  optExtra: { fontSize: 13, fontWeight: "600", marginTop: 5 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  addBtn: { height: 65, borderRadius: 20, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12 },
  addBtnText: { color: "white", fontWeight: "800", fontSize: 18 },
});
