import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';

interface CartSummaryProps {
  subtotal: number;
  tax: number;
  total: number;
}

export function CartSummary({ subtotal, tax, total }: CartSummaryProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: colors.borderLight }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Subtotal</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{formatCurrency(subtotal)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Tax</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{formatCurrency(tax)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
      <View style={styles.row}>
        <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Total</Text>
        <Text style={[styles.totalValue, { color: colors.textPrimary }]}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.base,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  value: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  totalLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
  totalValue: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
});
