import { View, Text, StyleSheet } from 'react-native';
import Animated, { Layout, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import type { CartItem } from '@/data/types';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

/**
 * Derive a stable colour from an item ID for the placeholder swatch.
 */
function getPlaceholderColor(id: string): string {
  const palette = [
    '#E85D3A', '#D4A843', '#4A90D9', '#6BBF6B',
    '#C75BD2', '#D96B4A', '#4AC5C5', '#CC7A33',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Build a readable string from selected customizations.
 * Returns option names joined with " · ".
 */
function formatCustomizations(item: CartItem): string {
  const names: string[] = [];
  for (const group of item.menuItem.customizations) {
    const selectedIds = item.selectedCustomizations[group.id] ?? [];
    for (const option of group.options) {
      if (selectedIds.includes(option.id)) {
        names.push(option.name);
      }
    }
  }
  return names.join(' \u00B7 ');
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const customizationText = formatCustomizations(item);

  return (
    <Animated.View
      layout={Layout.springify().damping(18).stiffness(200)}
      exiting={FadeOut.duration(250)}
      style={styles.container}
    >
      {/* Placeholder image swatch */}
      <View
        style={[
          styles.imagePlaceholder,
          { backgroundColor: getPlaceholderColor(item.menuItem.id) },
        ]}
      />

      {/* Center content */}
      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {item.menuItem.name}
        </Text>
        {customizationText.length > 0 && (
          <Text style={styles.customizations} numberOfLines={2}>
            {customizationText}
          </Text>
        )}
        <Text style={styles.lineTotal}>{formatCurrency(item.lineTotal)}</Text>
      </View>

      {/* Right side: quantity controls + remove */}
      <View style={styles.right}>
        <View style={styles.quantityRow}>
          <AnimatedPressable
            onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
            style={styles.qtyButton}
          >
            <Ionicons name="remove" size={18} color={colors.textPrimary} />
          </AnimatedPressable>

          <Text style={styles.qtyText}>{item.quantity}</Text>

          <AnimatedPressable
            onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
            style={styles.qtyButton}
          >
            <Ionicons name="add" size={18} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>

        <AnimatedPressable onPress={() => onRemove(item.id)} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
  },
  center: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  customizations: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  lineTotal: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  right: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
