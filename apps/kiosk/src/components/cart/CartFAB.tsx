import { Text, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';

interface CartFABProps {
  itemCount: number;
  total: number; // cents
  onPress: () => void;
}

export function CartFAB({ itemCount, total, onPress }: CartFABProps) {
  if (itemCount <= 0) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(200)}
      exiting={SlideOutDown.springify().damping(18).stiffness(200)}
      style={styles.wrapper}
    >
      <AnimatedPressable style={styles.bar} onPress={onPress} scaleValue={0.97}>
        {/* Left: cart icon + label */}
        <View style={styles.left}>
          <Ionicons name="cart" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>View Cart</Text>
        </View>

        {/* Right: count badge + total */}
        <View style={styles.right}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{itemCount}</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
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
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    minHeight: 60,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  countBadge: {
    backgroundColor: colors.primaryDark,
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
    color: colors.textPrimary,
  },
  total: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
});
