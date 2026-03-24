import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { printReceipt } from '@/services/printerService';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { config } from '@/constants/config';
import { OrderNumberDisplay } from '@/components/order/OrderNumberDisplay';
import { Button } from '@/components/ui/Button';
import type { ScreenProps } from '@/navigation/types';

const { width } = Dimensions.get('window');
const INITIAL_SECONDS = Math.floor(config.autoResetTimeout / 1000);

export function ThankYouScreen({ navigation, route }: ScreenProps<'ThankYou'>) {
  const { orderNumber } = route.params;
  const cartStore = useCartStore();
  const orderStore = useOrderStore();
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const orderType = useOrderStore((s) => s.orderType);

  const [countdown, setCountdown] = useState(INITIAL_SECONDS);
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'printed'>('idle');
  const isMounted = useRef(true);

  // Checkmark scale animation
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 10, stiffness: 150 });
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Countdown
  useEffect(() => {
    isMounted.current = true;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-reset when countdown hits 0
  useEffect(() => {
    if (countdown === 0 && isMounted.current) {
      cartStore.clearCart();
      orderStore.resetOrder();
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [countdown, cartStore, orderStore, navigation]);

  const handlePrintReceipt = useCallback(async () => {
    if (!currentOrder || printStatus !== 'idle') return;
    setPrintStatus('printing');
    try {
      await printReceipt(currentOrder);
    } catch {
      // Printing failed silently
    }
    if (!isMounted.current) return;
    setPrintStatus('printed');
    setTimeout(() => {
      if (isMounted.current) {
        setPrintStatus('idle');
      }
    }, 2000);
  }, [currentOrder, printStatus]);

  const orderTypeLabel = orderType === 'dine-in' ? 'Dine In' : 'Takeaway';

  const printButtonLabel =
    printStatus === 'printing'
      ? 'Printing...'
      : printStatus === 'printed'
        ? 'Receipt Printed!'
        : 'Print Receipt';

  return (
    <View style={styles.container}>
      {/* Radial glow at top */}
      <View style={styles.glowContainer}>
        <View style={styles.glowCircle} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Checkmark */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={styles.checkSection}
        >
          <Animated.View style={[styles.checkCircle, checkmarkStyle]}>
            <Ionicons name="checkmark" size={44} color={colors.textPrimary} />
          </Animated.View>
        </Animated.View>

        {/* Thank you heading */}
        <Animated.Text
          entering={FadeInDown.delay(250).duration(600)}
          style={styles.heading}
        >
          Thank You!
        </Animated.Text>

        {/* Order number */}
        <Animated.View entering={FadeInUp.delay(400).duration(700).springify()}>
          <OrderNumberDisplay orderNumber={orderNumber} />
        </Animated.View>

        {/* Order type badge */}
        <Animated.View
          entering={FadeInUp.delay(550).duration(500)}
          style={styles.orderTypeBadge}
        >
          <Ionicons
            name={orderType === 'dine-in' ? 'restaurant-outline' : 'bag-handle-outline'}
            size={16}
            color={colors.textPrimary}
          />
          <Text style={styles.orderTypeText}>{orderTypeLabel}</Text>
        </Animated.View>

        {/* Estimated wait */}
        <Animated.Text
          entering={FadeInUp.delay(650).duration(500)}
          style={styles.waitText}
        >
          Estimated wait: 5-10 minutes
        </Animated.Text>

        {/* Print receipt button */}
        <Animated.View
          entering={FadeInUp.delay(750).duration(500)}
          style={styles.printSection}
        >
          <Button
            onPress={handlePrintReceipt}
            variant="secondary"
            size="lg"
            loading={printStatus === 'printing'}
            disabled={printStatus === 'printing'}
            icon={
              printStatus === 'printed' ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : (
                <Ionicons name="print-outline" size={20} color={colors.primary} />
              )
            }
          >
            {printButtonLabel}
          </Button>
        </Animated.View>
      </View>

      {/* Countdown */}
      <Animated.Text
        entering={FadeInUp.delay(900).duration(500)}
        style={styles.countdown}
      >
        Starting new order in {countdown}s...
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },

  // Radial glow
  glowContainer: {
    position: 'absolute',
    top: -100,
    width: width,
    height: 300,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glowCircle: {
    width: width * 0.8,
    height: 300,
    borderRadius: width * 0.4,
    backgroundColor: colors.success,
    opacity: 0.06,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 20,
  },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  checkSection: {
    marginBottom: spacing.sm,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['4xl'],
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },

  // Order type badge
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderTypeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  // Wait text
  waitText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Print
  printSection: {
    marginTop: spacing.md,
  },

  // Countdown
  countdown: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing['3xl'],
  },
});
