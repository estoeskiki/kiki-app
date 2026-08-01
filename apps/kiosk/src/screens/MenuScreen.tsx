import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { CartFAB } from '@/components/cart/CartFAB';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useMenuStore } from '@/store/useMenuStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { supabase } from '@/lib/supabase';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MenuItem } from '@/data/types';
import type { ScreenProps } from '@/navigation/types';

export function MenuScreen({ route, navigation }: ScreenProps<'Menu'>) {
  const { categories, items: menuItems, fetchMenu } = useMenuStore();
  const clearCart = useCartStore((s) => s.clearCart);
  const removeItemsByRestaurant = useCartStore((s) => s.removeItemsByRestaurant);
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const mode = useAuthStore((s) => s.mode);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const closedAlertShown = useRef(false);

  const selectedRestaurantId = route.params?.restaurantId;
  const selectedRestaurantName = route.params?.restaurantName;

  const handleRestart = useCallback(() => {
    Alert.alert(
      t('startNewOrder'),
      t('startNewOrderConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirmRestart'),
          style: 'destructive',
          onPress: () => {
            clearCart();
            resetOrder();
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
          },
        },
      ]
    );
  }, [clearCart, resetOrder, navigation]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // No realtime menu subscription (matches order-web). Availability/closure is
  // authoritatively re-checked at the cart (get_cart_validity) and at submit
  // (create-web-order), so a persistent websocket per kiosk isn't worth it.
  // Refetch on screen focus and when the app returns to the foreground.
  useFocusEffect(
    useCallback(() => {
      fetchMenu(selectedRestaurantId);
    }, [fetchMenu, selectedRestaurantId]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchMenu(selectedRestaurantId);
    });
    return () => sub.remove();
  }, [fetchMenu, selectedRestaurantId]);

  // Realtime: watch if this restaurant closes while user is browsing
  useEffect(() => {
    if (!selectedRestaurantId || mode !== 'food_court') return;
    closedAlertShown.current = false;

    const channel = supabase
      .channel(`menu_restaurant_status_${selectedRestaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${selectedRestaurantId}`,
        },
        (payload) => {
          if (payload.new && payload.new.is_open === false && !closedAlertShown.current) {
            closedAlertShown.current = true;
            // Remove this restaurant's items from cart
            removeItemsByRestaurant(selectedRestaurantId);
            // Alert and go back to directory
            Alert.alert(
              '¡Restaurante cerrado!',
              `${selectedRestaurantName || 'Este restaurante'} acaba de cerrar. Los productos se removieron del carrito.`,
              [{ text: 'OK', onPress: () => navigation.goBack() }],
              { cancelable: false }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRestaurantId, mode]);

  // Reset category selection when switching restaurants (food court navigation)
  useEffect(() => {
    setSelectedCategoryId('');
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (categories.length > 0 && (!selectedCategoryId || !categories.find(c => c.id === selectedCategoryId))) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories]);

  const cartItems = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);

  const totalItemCount = useMemo(
    () => cartItems.reduce((sum, ci) => sum + ci.quantity, 0),
    [cartItems],
  );

  const cartTotal = getTotal();

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.categoryId === selectedCategoryId && item.available),
    [selectedCategoryId, menuItems],
  );

  // The "+" quick-add button opens the same detail modal as tapping the card
  // — it never adds directly, matching order-web (onAdd={setSelectedItem}).
  // Quantity/customization is always chosen there before it hits the cart.
  const handleItemPress = useCallback((item: MenuItem) => {
    navigation.navigate('ItemDetail', { item, restaurantId: selectedRestaurantId, restaurantName: selectedRestaurantName });
  }, [navigation, selectedRestaurantId, selectedRestaurantName]);

  return (
    <ScreenWrapper padded={false}>
      {mode === 'food_court' && (
        // Solid lime, matching the directory banner + order-web (no more
        // tinted/bordered strip).
        <View style={[styles.multiRestaurantBanner, { backgroundColor: colors.primary }]}>
          <Text style={[styles.multiRestaurantBannerText, { color: colors.onPrimary }]}>{t('multiRestaurantBanner')}</Text>
        </View>
      )}
      <Header
        title={t('menu')}
        onBack={() => navigation.goBack()}
        // Only labeled "Volver a restaurantes" in food-court mode, where
        // back genuinely returns to the restaurant catalog (Directory) — in
        // standalone mode this goes to Welcome instead, so it stays a bare
        // chevron there rather than a misleading label.
        backLabel={mode === 'food_court' ? t('backToRestaurants') : undefined}
        secondaryRightAction={{ icon: 'restart', onPress: handleRestart, label: t('restartOrder') }}
        rightAction={{ icon: 'cart', onPress: () => navigation.navigate('Checkout'), badge: totalItemCount > 0 ? totalItemCount : undefined }}
      />
      <CategoryTabs categories={categories} selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
      <View style={styles.gridContainer}>
        <MenuGrid items={filteredItems} onItemPress={handleItemPress} onQuickAdd={handleItemPress} />
      </View>
      <CartFAB itemCount={totalItemCount} total={cartTotal} onPress={() => navigation.navigate('Checkout')} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  gridContainer: { flex: 1 },
  // Very thin strip — a reminder that stays visible through the whole
  // shopping session (not just the directory banner shown once, up front),
  // that items from other restaurants can join this same order.
  multiRestaurantBanner: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  multiRestaurantBannerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
