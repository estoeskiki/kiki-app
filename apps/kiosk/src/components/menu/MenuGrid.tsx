import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { spacing } from '@/theme/spacing';
import type { MenuItem } from '@/data/types';

interface MenuGridProps {
  items: MenuItem[];
  onItemPress: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

const COLUMN_GAP = spacing.md;

export function MenuGrid({ items, onItemPress, onQuickAdd }: MenuGridProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: MenuItem; index: number }) => {
      // Staggered fade-in: each row delays a bit more
      const delay = Math.floor(index / 2) * 80;

      return (
        <Animated.View
          entering={FadeInUp.delay(delay).duration(350).springify()}
          style={styles.itemWrapper}
        >
          <MenuItemCard
            item={item}
            onPress={() => onItemPress(item)}
            onQuickAdd={() => onQuickAdd(item)}
          />
        </Animated.View>
      );
    },
    [onItemPress, onQuickAdd],
  );

  const keyExtractor = useCallback((item: MenuItem) => item.id, []);

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={Separator}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
    paddingTop: spacing.sm,
  },
  row: {
    gap: COLUMN_GAP,
  },
  separator: {
    height: COLUMN_GAP,
  },
  itemWrapper: {
    flex: 1,
  },
});
