import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { CartFAB } from '@/components/cart/CartFAB';
import { useCartStore } from '@/store/useCartStore';
import { useMenuStore } from '@/store/useMenuStore';
import type { MenuItem } from '@/data/types';
import type { ScreenProps } from '@/navigation/types';

export function MenuScreen({ navigation }: ScreenProps<'Menu'>) {
  const { categories, items: menuItems, fetchMenu, subscribeToMenu, unsubscribeFromMenu } = useMenuStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Fetch initial data and subscribe to realtime updates
  useEffect(() => {
    fetchMenu();
    subscribeToMenu();
    return () => {
      unsubscribeFromMenu();
    };
  }, [fetchMenu, subscribeToMenu, unsubscribeFromMenu]);

  // Set default category when categories load
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

  // Filter items by selected category and availability
  const filteredItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.categoryId === selectedCategoryId && item.available,
      ),
    [selectedCategoryId],
  );

  const handleItemPress = useCallback(
    (item: MenuItem) => {
      navigation.navigate('ItemDetail', { item });
    },
    [navigation],
  );

  const handleQuickAdd = useCallback(
    (item: MenuItem) => {
      // If the item has any required customization groups, navigate to detail instead
      const hasRequiredCustomization = item.customizations.some(
        (group) => group.required,
      );

      if (hasRequiredCustomization) {
        navigation.navigate('ItemDetail', { item });
        return;
      }

      // Quick-add with qty 1 and no customizations
      addItem(item, 1, {});
    },
    [addItem, navigation],
  );

  const handleCartPress = useCallback(() => {
    navigation.navigate('Cart');
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <ScreenWrapper padded={false}>
      <Header
        title="Menu"
        onBack={handleBack}
        rightAction={{
          icon: 'cart-outline',
          onPress: handleCartPress,
          badge: totalItemCount > 0 ? totalItemCount : undefined,
        }}
      />

      {/* Sticky category tabs */}
      <CategoryTabs
        categories={categories}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />

      {/* Menu grid fills remaining space */}
      <View style={styles.gridContainer}>
        <MenuGrid
          items={filteredItems}
          onItemPress={handleItemPress}
          onQuickAdd={handleQuickAdd}
        />
      </View>

      {/* Floating cart bar */}
      <CartFAB
        itemCount={totalItemCount}
        total={cartTotal}
        onPress={handleCartPress}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
  },
});
