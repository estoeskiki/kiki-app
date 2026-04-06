import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import { useTranslation } from '@/i18n/useTranslation';
import type { CartItem } from '@/data/types';

interface OrderReviewListProps {
  items: CartItem[];
}

/**
 * Build a readable string from selected customizations.
 */
function formatCustomizations(item: CartItem, localize: (val: any) => string): string {
  const names: string[] = [];
  for (const group of item.menuItem.customizations) {
    const selectedIds = item.selectedCustomizations[group.id] ?? [];
    for (const option of group.options) {
      if (selectedIds.includes(option.id)) {
        names.push(localize(option.name));
      }
    }
  }
  return names.join(' \u00B7 ');
}

export function OrderReviewList({ items }: OrderReviewListProps) {
  const { localize } = useTranslation();

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const customizationText = formatCustomizations(item, localize);

        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.left}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {localize(item.menuItem.name)}
                </Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>x{item.quantity}</Text>
                </View>
              </View>
              {customizationText.length > 0 && (
                <Text style={styles.customizations} numberOfLines={2}>
                  {customizationText}
                </Text>
              )}
            </View>

            <Text style={styles.lineTotal}>{formatCurrency(item.lineTotal)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  left: {
    flex: 1,
    marginRight: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  qtyBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  qtyBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  customizations: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  lineTotal: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
});
