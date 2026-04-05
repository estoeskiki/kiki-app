import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { CheckCircle, Printer } from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { printReceipt } from '@/services/printerService';
import { useTheme } from '@/context/ThemeContext';
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
  const { colors } = useTheme();

  const [countdown, setCountdown] = useState(INITIAL_SECONDS);
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'printed'>('idle');
  const isMounted = useRef(true);

  const checkScale = useSharedValue(0);
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 10, stiffness: 150 });
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

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
    try { await printReceipt(currentOrder); } catch { /* silent */ }
    if (!isMounted.current) return;
    setPrintStatus('printed');
    setTimeout(() => { if (isMounted.current) setPrintStatus('idle'); }, 2000);
  }, [currentOrder, printStatus]);

  const handleStartNew = useCallback(() => {
    cartStore.clearCart();
    orderStore.resetOrder();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }, [cartStore, orderStore, navigation]);

  const orderTypeLabel = orderType === 'dine-in' ? 'Dine In' : 'Takeaway';
  const printLabel = printStatus === 'printing' ? 'Printing…' : printStatus === 'printed' ? 'Receipt Printed!' : 'Print Receipt';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top lime accent line */}
      <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

      {/* Success glow */}
      <View style={[styles.glowRing, { borderColor: colors.primary }]} />

      <View style={styles.content}>
        {/* Check icon */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.checkSection}>
          <Animated.View style={[styles.checkCircle, { backgroundColor: colors.surfaceContainer }, checkmarkStyle]}>
            <CheckCircle size={48} color={colors.success} strokeWidth={1.5} />
          </Animated.View>
        </Animated.View>

        {/* Heading */}
        <Animated.Text entering={FadeInDown.delay(220).duration(600)} style={[styles.heading, { color: colors.textPrimary }]}>
          Thank You!
        </Animated.Text>

        {/* Order number */}
        <Animated.View entering={FadeInUp.delay(380).duration(700).springify()}>
          <OrderNumberDisplay orderNumber={orderNumber} />
        </Animated.View>

        {/* Order type */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(500)}
          style={[styles.typePill, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.typeText, { color: colors.onPrimary }]}>{orderTypeLabel}</Text>
        </Animated.View>

        {/* Wait time */}
        <Animated.Text entering={FadeInUp.delay(580).duration(500)} style={[styles.waitText, { color: colors.textMuted }]}>
          Estimated wait: 5–10 minutes
        </Animated.Text>

        {/* Print */}
        <Animated.View entering={FadeInUp.delay(680).duration(500)} style={styles.printSection}>
          <Button
            onPress={handlePrintReceipt}
            variant="secondary"
            size="lg"
            loading={printStatus === 'printing'}
            disabled={printStatus === 'printing'}
            icon={<Printer size={18} color={colors.textSecondary} strokeWidth={1.8} />}
          >
            {printLabel}
          </Button>
        </Animated.View>
      </View>

      {/* Start new order — only visible after receipt is printed */}
      {printStatus === 'printed' ? (
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={styles.startNewSection}
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={handleStartNew}
          >
            {`Start New Order (${countdown}s)`}
          </Button>
        </Animated.View>
      ) : (
        <Animated.Text
          entering={FadeInUp.delay(850).duration(500)}
          style={[styles.countdownHint, { color: colors.textMuted }]}
        >
          Auto-reset in {countdown}s
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  glowRing: {
    position: 'absolute',
    top: -width * 0.6,
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    borderWidth: 1,
    opacity: 0.1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  checkSection: {},
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['4xl'],
    letterSpacing: -1,
    textAlign: 'center',
  },
  typePill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  typeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.5,
  },
  waitText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
  },
  printSection: {
    marginTop: spacing.md,
  },
  startNewSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    width: '100%',
  },
  countdownHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    paddingBottom: spacing['3xl'],
    letterSpacing: 0.3,
  },
});
