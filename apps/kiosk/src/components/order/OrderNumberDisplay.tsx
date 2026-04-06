import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

interface OrderNumberDisplayProps {
  orderNumber: number;
}

export function OrderNumberDisplay({ orderNumber }: OrderNumberDisplayProps) {
  const formatted = String(orderNumber).padStart(2, '0');
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Glow effect behind the number */}
      <View style={styles.glow} />

      <View style={styles.inner}>
        <Text style={styles.label}>{t('orderLabel')}</Text>
        <Text style={styles.number}>#{formatted}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    opacity: 0.1,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: borderRadius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['4xl'],
    minWidth: 220,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  number: {
    fontFamily: fonts.heading,
    fontSize: 72,
    color: colors.primary,
    letterSpacing: 2,
    lineHeight: 80,
  },
});
