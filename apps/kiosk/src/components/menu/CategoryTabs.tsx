import { useRef, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { Category } from '@/data/types';

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  const handleSelect = useCallback((id: string) => { onSelect(id); }, [onSelect]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
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
                isSelected
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight },
              ]}
              scaleValue={0.95}
            >
              <Text
                style={[
                  styles.pillLabel,
                  { color: isSelected ? colors.onPrimary : colors.textSecondary },
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  pillLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.1,
  },
});
