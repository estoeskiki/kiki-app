import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { X, Minus, Plus } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/store/useCartStore';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import { mediumTap } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTranslation } from '@/i18n/useTranslation';
import type { ScreenProps } from '@/navigation/types';
import type { CustomizationGroup } from '@/data/types';

// Soft plate colors for item hero
const LIGHT_PLATES = [
  '#eef3ff', '#f0fff4', '#fff4f0', '#f9f0ff',
  '#f0fffe', '#fffbf0', '#fff0f5', '#f0f7ff',
] as const;
const DARK_PLATES = [
  '#0a1730', '#0a2a1a', '#1a0a00', '#180a30',
  '#001a2a', '#1a1800', '#2a0a18', '#0a1820',
] as const;

function getPlateColor(id: string, isDark: boolean): string {
  const p = isDark ? DARK_PLATES : LIGHT_PLATES;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

export function ItemDetailModal({ navigation, route }: ScreenProps<'ItemDetail'>) {
  const { item, restaurantId, restaurantName } = route.params;
  const addItem = useCartStore((s) => s.addItem);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { localize } = useTranslation();

  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of item.customizations) init[g.id] = [];
    return init;
  });
  const [quantity, setQuantity] = useState(1);

  const handleToggleOption = useCallback((group: CustomizationGroup, optionId: string) => {
    setSelectedCustomizations((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelections === 1) {
        if (current.includes(optionId) && !group.required) return { ...prev, [group.id]: [] };
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      if (current.length >= group.maxSelections) return { ...prev, [group.id]: [...current.slice(1), optionId] };
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }, []);

  const modifierTotal = useMemo(() => {
    let total = 0;
    for (const g of item.customizations) {
      const ids = selectedCustomizations[g.id] ?? [];
      for (const opt of g.options) { if (ids.includes(opt.id)) total += opt.priceModifier; }
    }
    return total;
  }, [item.customizations, selectedCustomizations]);

  const lineTotal = (item.price + modifierTotal) * quantity;

  const canAdd = useMemo(() => {
    for (const g of item.customizations) {
      if (g.required && (selectedCustomizations[g.id] ?? []).length === 0) return false;
    }
    return true;
  }, [item.customizations, selectedCustomizations]);

  const handleAddToCart = useCallback(() => {
    if (!canAdd) return;
    mediumTap();
    addItem(item, quantity, selectedCustomizations, restaurantId, restaurantName);
    navigation.goBack();
  }, [canAdd, addItem, item, quantity, selectedCustomizations, navigation, restaurantId, restaurantName]);

  const heroColor = getPlateColor(item.id, isDark);
  const initial = localize(item.name).trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: heroColor }]}>
          <Text style={[styles.heroInitial, { color: colors.textSecondary, opacity: 0.2 }]}>{initial}</Text>
          {/* Close button */}
          <Pressable
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <X size={20} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
          {item.popular && (
            <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.popularText, { color: colors.onPrimary }]}>★ Popular</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.details}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>{localize(item.name)}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>{localize(item.description)}</Text>
          <Text style={[styles.basePrice, { color: colors.textPrimary }]}>{formatCurrency(item.price)}</Text>

          {/* Customization groups */}
          {item.customizations.map((group) => (
            <View key={group.id} style={[styles.groupContainer, { borderTopColor: colors.borderLight }]}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: colors.textPrimary }]}>{localize(group.name)}</Text>
                {group.required && (
                  <View style={[styles.requiredBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.requiredText, { color: colors.onPrimary }]}>Required</Text>
                  </View>
                )}
                {!group.required && group.maxSelections > 1 && (
                  <Text style={[styles.maxText, { color: colors.textMuted }]}>Up to {group.maxSelections}</Text>
                )}
              </View>

              {group.options.map((option) => {
                const isSelected = (selectedCustomizations[group.id] ?? []).includes(option.id);
                const isRadio = group.maxSelections === 1;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.borderLight,
                      },
                    ]}
                    onPress={() => handleToggleOption(group, option.id)}
                  >
                    <View style={[
                      isRadio ? styles.radio : styles.checkbox,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { backgroundColor: colors.primary },
                    ]}>
                      {isSelected && !isRadio && (
                        <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '800' }}>✓</Text>
                      )}
                      {isSelected && isRadio && (
                        <View style={[styles.radioDot, { backgroundColor: colors.onPrimary }]} />
                      )}
                    </View>
                    <Text style={[styles.optionName, { color: isSelected ? colors.textPrimary : colors.textSecondary }]}>
                      {localize(option.name)}
                    </Text>
                    {option.priceModifier !== 0 && (
                      <Text style={[styles.optionPrice, { color: isSelected ? colors.textPrimary : colors.textMuted }]}>
                        {option.priceModifier > 0 ? '+' : ''}{formatCurrency(option.priceModifier)}
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
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base), backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
        {/* Quantity */}
        <View style={[styles.qtyRow, { backgroundColor: colors.surfaceContainer }]}>
          <AnimatedPressable style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]} onPress={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
            <Minus size={18} color={quantity <= 1 ? colors.textMuted : colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
          <Text style={[styles.qtyText, { color: colors.textPrimary }]}>{quantity}</Text>
          <AnimatedPressable style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
            <Plus size={18} color={colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>

        {/* Add to cart */}
        <AnimatedPressable
          style={[styles.addBtn, { backgroundColor: colors.primary }, !canAdd && styles.addBtnDisabled]}
          onPress={handleAddToCart}
          disabled={!canAdd}
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>
            Add to Cart — {formatCurrency(lineTotal)}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  // Hero
  hero: {
    height: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: {
    fontFamily: fonts.heading,
    fontSize: 140,
    fontWeight: '900',
    lineHeight: 140,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  popularText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.3,
  },
  // Details
  details: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  itemName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.6,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.5,
  },
  basePrice: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
  // Groups
  groupContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  groupName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
    letterSpacing: -0.3,
    flex: 1,
  },
  requiredBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  requiredText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.2,
  },
  maxText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
  },
  optionPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  // Bottom
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    gap: spacing.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    height: 52,
    gap: spacing.xl,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    minWidth: 36,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  addBtn: {
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
});
