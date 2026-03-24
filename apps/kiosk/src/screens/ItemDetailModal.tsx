import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/store/useCartStore';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import { mediumTap } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import type { ScreenProps } from '@/navigation/types';
import type { CustomizationGroup } from '@/data/types';

/**
 * Deterministic placeholder colors based on item id.
 */
const PLACEHOLDER_COLORS = [
  '#5C2D0E',
  '#1B3A4B',
  '#1A3C2B',
  '#3B1F3B',
  '#4A2C1A',
  '#2A2D4E',
  '#3D2B1F',
  '#1F3B3D',
] as const;

function getPlaceholderColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

const CATEGORY_EMOJI: Record<string, string> = {
  'cat-burgers': '\uD83C\uDF54',
  'cat-sides': '\uD83C\uDF5F',
  'cat-drinks': '\uD83E\uDD64',
  'cat-desserts': '\uD83C\uDF70',
  'cat-combos': '\u2B50',
};

function getItemEmoji(categoryId: string): string {
  return CATEGORY_EMOJI[categoryId] ?? '\uD83C\uDF7D\uFE0F';
}

export function ItemDetailModal({ navigation, route }: ScreenProps<'ItemDetail'>) {
  const { item } = route.params;
  const addItem = useCartStore((s) => s.addItem);
  const insets = useSafeAreaInsets();

  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string[]>>(
    () => {
      const init: Record<string, string[]> = {};
      for (const group of item.customizations) {
        init[group.id] = [];
      }
      return init;
    },
  );
  const [quantity, setQuantity] = useState(1);

  const handleToggleOption = useCallback(
    (group: CustomizationGroup, optionId: string) => {
      setSelectedCustomizations((prev) => {
        const current = prev[group.id] ?? [];

        if (group.maxSelections === 1) {
          // Radio behavior: select this one (or deselect if already selected and not required)
          if (current.includes(optionId) && !group.required) {
            return { ...prev, [group.id]: [] };
          }
          return { ...prev, [group.id]: [optionId] };
        }

        // Checkbox behavior
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        }

        if (current.length >= group.maxSelections) {
          // Replace the oldest selection
          return { ...prev, [group.id]: [...current.slice(1), optionId] };
        }

        return { ...prev, [group.id]: [...current, optionId] };
      });
    },
    [],
  );

  const modifierTotal = useMemo(() => {
    let total = 0;
    for (const group of item.customizations) {
      const selectedIds = selectedCustomizations[group.id] ?? [];
      for (const option of group.options) {
        if (selectedIds.includes(option.id)) {
          total += option.priceModifier;
        }
      }
    }
    return total;
  }, [item.customizations, selectedCustomizations]);

  const lineTotal = (item.price + modifierTotal) * quantity;

  const canAdd = useMemo(() => {
    for (const group of item.customizations) {
      if (group.required && (selectedCustomizations[group.id] ?? []).length === 0) {
        return false;
      }
    }
    return true;
  }, [item.customizations, selectedCustomizations]);

  const handleAddToCart = useCallback(() => {
    if (!canAdd) return;
    mediumTap();
    addItem(item, quantity, selectedCustomizations);
    navigation.goBack();
  }, [canAdd, addItem, item, quantity, selectedCustomizations, navigation]);

  const bgColor = getPlaceholderColor(item.id);
  const emoji = getItemEmoji(item.categoryId);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero image placeholder */}
        <View style={[styles.heroArea, { backgroundColor: bgColor }]}>
          <Text style={styles.heroEmoji}>{emoji}</Text>

          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Details */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.details}>
          <View style={styles.titleRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.basePrice}>{formatCurrency(item.price)}</Text>

          {/* Customization groups */}
          {item.customizations.map((group) => (
            <View key={group.id} style={styles.groupContainer}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{group.name}</Text>
                {group.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                )}
                {!group.required && group.maxSelections > 1 && (
                  <Text style={styles.maxSelectionsText}>
                    Up to {group.maxSelections}
                  </Text>
                )}
              </View>

              {group.options.map((option) => {
                const isSelected = (selectedCustomizations[group.id] ?? []).includes(option.id);
                const isRadio = group.maxSelections === 1;

                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => handleToggleOption(group, option.id)}
                  >
                    {/* Indicator */}
                    <View
                      style={[
                        isRadio ? styles.radioOuter : styles.checkboxOuter,
                        isSelected && styles.indicatorSelected,
                      ]}
                    >
                      {isSelected &&
                        (isRadio ? (
                          <View style={styles.radioInner} />
                        ) : (
                          <Ionicons name="checkmark" size={14} color={colors.textPrimary} />
                        ))}
                    </View>

                    {/* Label */}
                    <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                      {option.name}
                    </Text>

                    {/* Price modifier */}
                    {option.priceModifier !== 0 && (
                      <Text style={[styles.optionPrice, isSelected && styles.optionPriceSelected]}>
                        {option.priceModifier > 0 ? '+' : ''}
                        {formatCurrency(option.priceModifier)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
        {/* Quantity selector */}
        <View style={styles.quantityRow}>
          <AnimatedPressable
            style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            <Ionicons
              name="remove"
              size={22}
              color={quantity <= 1 ? colors.textMuted : colors.textPrimary}
            />
          </AnimatedPressable>

          <Text style={styles.quantityText}>{quantity}</Text>

          <AnimatedPressable
            style={styles.quantityButton}
            onPress={() => setQuantity((q) => q + 1)}
          >
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>

        {/* Add to cart */}
        <AnimatedPressable
          style={[styles.addToCartButton, !canAdd && styles.addToCartDisabled]}
          onPress={handleAddToCart}
          disabled={!canAdd}
        >
          <Text style={styles.addToCartText}>
            Add to Cart — {formatCurrency(lineTotal)}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // Hero
  heroArea: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 80,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Details
  details: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  itemName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
    flexShrink: 1,
  },
  popularBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMuted,
    lineHeight: fontSizes.base * 1.5,
    marginBottom: spacing.md,
  },
  basePrice: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.primary,
    marginBottom: spacing.xl,
  },

  // Customization groups
  groupContainer: {
    marginBottom: spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  groupName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  requiredBadge: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  requiredText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    color: colors.textPrimary,
  },
  maxSelectionsText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },

  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },

  // Radio indicator
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  // Checkbox indicator
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  indicatorSelected: {
    borderColor: colors.primary,
  },

  optionName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  optionNameSelected: {
    color: colors.textPrimary,
  },
  optionPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  optionPriceSelected: {
    color: colors.primary,
  },

  // Bottom bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    gap: spacing.md,
  },

  // Quantity
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },

  // Add to cart
  addToCartButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  addToCartDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
});
