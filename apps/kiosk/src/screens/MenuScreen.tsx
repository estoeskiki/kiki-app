import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { CartFAB } from '@/components/cart/CartFAB';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useMenuStore } from '@/store/useMenuStore';
import type { MenuItem } from '@/data/types';
import type { ScreenProps } from '@/navigation/types';

export function MenuScreen({ navigation }: ScreenProps<'Menu'>) {
  const { categories, items: menuItems, fetchMenu, subscribeToMenu, unsubscribeFromMenu } = useMenuStore();
  const clearCart = useCartStore((s) => s.clearCart);
  const resetOrder = useOrderStore((s) => s.resetOrder);

  const handleRestart = useCallback(() => {
    Alert.alert(
      'Start New Order',
      'This will clear your current cart and start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
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

  useEffect(() => {
    fetchMenu();
    subscribeToMenu();
    return () => { unsubscribeFromMenu(); };
  }, [fetchMenu, subscribeToMenu, unsubscribeFromMenu]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
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

  const handleItemPress = useCallback((item: MenuItem) => {
    navigation.navigate('ItemDetail', { item });
  }, [navigation]);

  const handleQuickAdd = useCallback((item: MenuItem) => {
    const hasRequired = item.customizations.some((g) => g.required);
    if (hasRequired) {
      navigation.navigate('ItemDetail', { item });
      return;
    }
    addItem(item, 1, {});
  }, [addItem, navigation]);

  return (
    <ScreenWrapper padded={false}>
      <Header
        title="Menu"
        onBack={() => navigation.goBack()}
        secondaryRightAction={{ icon: 'restart', onPress: handleRestart }}
        rightAction={{ icon: 'cart', onPress: () => navigation.navigate('Cart'), badge: totalItemCount > 0 ? totalItemCount : undefined }}
      />
      <CategoryTabs categories={categories} selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
      <View style={styles.gridContainer}>
        <MenuGrid items={filteredItems} onItemPress={handleItemPress} onQuickAdd={handleQuickAdd} />
      </View>
      <CartFAB itemCount={totalItemCount} total={cartTotal} onPress={() => navigation.navigate('Cart')} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  gridContainer: { flex: 1 },
});
