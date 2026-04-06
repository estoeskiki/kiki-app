import { Text, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ShoppingCart } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';

interface CartFABProps {
  itemCount: number;
  total: number;
  onPress: () => void;
}

export function CartFAB({ itemCount, total, onPress }: CartFABProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (itemCount <= 0) return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(200)}
      exiting={SlideOutDown.springify().damping(18).stiffness(200)}
      style={styles.wrapper}
    >
      <AnimatedPressable
        style={[
          styles.bar,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
        onPress={onPress}
        scaleValue={0.97}
      >
        {/* Left */}
        <View style={styles.left}>
          <ShoppingCart size={20} color={colors.onPrimary} strokeWidth={2.5} />
          <Text style={[styles.label, { color: colors.onPrimary }]}>{t('viewCart')}</Text>
        </View>

        {/* Right: count + total */}
        <View style={styles.right}>
          <View style={[styles.countBadge, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
            <Text style={[styles.countText, { color: colors.onPrimary }]}>{itemCount}</Text>
          </View>
          <Text style={[styles.total, { color: colors.onPrimary }]}>{formatCurrency(total)}</Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: spacing['2xl'],
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    minHeight: 62,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
    letterSpacing: -0.2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  countBadge: {
    borderRadius: borderRadius.full,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  total: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
  },
});
