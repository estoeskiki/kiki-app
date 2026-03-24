import { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { processPayment } from '@/services/posService';
import { createOrder } from '@/services/orderService';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { config } from '@/constants/config';
import { successNotification, errorNotification } from '@/utils/haptics';
import { Button } from '@/components/ui/Button';
import type { ScreenProps } from '@/navigation/types';
import type { Order } from '@/data/types';

type PaymentState = 'processing' | 'success' | 'failed';

export function PaymentScreen({ navigation }: ScreenProps<'Payment'>) {
  const cartStore = useCartStore();
  const orderStore = useOrderStore();

  const [state, setState] = useState<PaymentState>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Spinner rotation
  const rotation = useSharedValue(0);

  // Success scale-in
  const successScale = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      isMounted.current = false;
    };
  }, []);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const successIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  const runPayment = useCallback(async () => {
    setState('processing');
    setErrorMessage(null);
    orderStore.setOrderStatus('processing');

    const total = cartStore.getTotal();
    const subtotal = cartStore.getSubtotal();
    const tax = cartStore.getTax();

    try {
      const paymentResult = await processPayment({
        amount: total,
        currency: config.currency,
        reference: `KIKI-${Date.now().toString(36).toUpperCase()}`,
      });

      if (!isMounted.current) return;

      if (paymentResult.success && paymentResult.transactionId) {
        // Create the order
        const orderResult = await createOrder({
          orderType: orderStore.orderType!,
          items: cartStore.items,
          subtotal,
          tax,
          total,
          paymentTransactionId: paymentResult.transactionId,
        });

        if (!isMounted.current) return;

        const order: Order = {
          id: orderResult.orderId,
          orderNumber: orderResult.orderNumber,
          orderType: orderStore.orderType!,
          items: [...cartStore.items],
          subtotal,
          tax,
          total,
          status: 'confirmed',
          transactionId: paymentResult.transactionId,
          createdAt: orderResult.createdAt,
        };

        orderStore.setCurrentOrder(order);
        orderStore.setOrderStatus('success');
        setState('success');
        successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        successNotification();

        // Navigate after brief delay
        setTimeout(() => {
          if (!isMounted.current) return;
          cartStore.clearCart();
          navigation.reset({
            index: 0,
            routes: [
              { name: 'Welcome' },
              { name: 'ThankYou', params: { orderNumber: orderResult.orderNumber } },
            ],
          });
        }, 1500);
      } else {
        orderStore.setOrderStatus('failed');
        setState('failed');
        setErrorMessage(paymentResult.error ?? 'Payment was declined.');
        errorNotification();
      }
    } catch (err) {
      if (!isMounted.current) return;
      orderStore.setOrderStatus('failed');
      setState('failed');
      setErrorMessage('An unexpected error occurred. Please try again.');
      errorNotification();
    }
  }, [cartStore, orderStore, navigation, successScale]);

  // Run payment on mount
  useEffect(() => {
    runPayment();
  }, []);

  const handleCancel = useCallback(() => {
    orderStore.setOrderStatus('idle');
    navigation.goBack();
  }, [orderStore, navigation]);

  return (
    <View style={styles.container}>
      {state === 'processing' && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.stateContainer}
          key="processing"
        >
          {/* Premium spinner */}
          <Animated.View style={[styles.spinner, spinnerStyle]}>
            <View style={styles.spinnerArc} />
          </Animated.View>

          <Text style={styles.processingTitle}>Processing Payment...</Text>
          <Text style={styles.processingSubtitle}>
            Please follow the instructions on the terminal
          </Text>
        </Animated.View>
      )}

      {state === 'success' && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.stateContainer}
          key="success"
        >
          <Animated.View style={[styles.successCircle, successIconStyle]}>
            <Ionicons name="checkmark" size={48} color={colors.textPrimary} />
          </Animated.View>

          <Text style={styles.successTitle}>Payment Approved!</Text>
          <Text style={styles.processingSubtitle}>Preparing your order...</Text>
        </Animated.View>
      )}

      {state === 'failed' && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.stateContainer}
          key="failed"
        >
          <View style={styles.failedCircle}>
            <Ionicons name="close" size={48} color={colors.textPrimary} />
          </View>

          <Text style={styles.failedTitle}>Payment Failed</Text>
          {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

          <View style={styles.failedActions}>
            <Button onPress={runPayment} variant="primary" size="xl" fullWidth>
              Try Again
            </Button>
            <Button onPress={handleCancel} variant="ghost" size="lg" fullWidth>
              Cancel Order
            </Button>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
  },

  // Spinner
  spinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.surfaceHighlight,
    marginBottom: spacing['2xl'],
  },
  spinnerArc: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: colors.primary,
  },

  // Processing
  processingTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  processingSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: fontSizes.base * 1.5,
  },

  // Success
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  successTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // Failed
  failedCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  failedTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: fontSizes.base * 1.5,
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.base,
  },
  failedActions: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
