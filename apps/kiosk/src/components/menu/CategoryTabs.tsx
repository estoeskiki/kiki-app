import { useRef, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { Category } from '@/data/types';

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CategoryTabs({
  categories,
  selectedId,
  onSelect,
}: CategoryTabsProps) {
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => {
          const isSelected = category.id === selectedId;

          return (
            <AnimatedPressable
              key={category.id}
              onPress={() => handleSelect(category.id)}
              style={[
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected,
              ]}
              scaleValue={0.95}
            >
              <Text style={styles.pillIcon}>{category.icon}</Text>
              <Text
                style={[
                  styles.pillLabel,
                  isSelected
                    ? styles.pillLabelSelected
                    : styles.pillLabelUnselected,
                ]}
              >
                {category.name}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    minHeight: 48,
    gap: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  pillUnselected: {
    backgroundColor: colors.surfaceElevated,
  },
  pillIcon: {
    fontSize: fontSizes.lg,
  },
  pillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
  },
  pillLabelSelected: {
    color: colors.textPrimary,
  },
  pillLabelUnselected: {
    color: colors.textSecondary,
  },
});
