import { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { processPayment } from '@/services/posService';
import { createOrder } from '@/services/orderService';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
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
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [state, setState] = useState<PaymentState>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMounted = useRef(true);

  const rotation = useSharedValue(0);
  const successScale = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
    return () => { isMounted.current = false; };
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
        setErrorMessage(paymentResult.error ?? t('paymentDeclined'));
        errorNotification();
      }
    } catch {
      if (!isMounted.current) return;
      orderStore.setOrderStatus('failed');
      setState('failed');
      setErrorMessage(t('unexpectedError'));
      errorNotification();
    }
  }, [cartStore, orderStore, navigation, successScale]);

  useEffect(() => { runPayment(); }, []);

  const handleCancel = useCallback(() => {
    orderStore.setOrderStatus('idle');
    navigation.goBack();
  }, [orderStore, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {state === 'processing' && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stateContainer} key="processing">
          <Animated.View style={[styles.spinner, { borderColor: colors.borderLight }, spinnerStyle]}>
            <View style={[styles.spinnerArc, { borderTopColor: colors.primary }]} />
          </Animated.View>
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>{t('processing')}</Text>
          <Text style={[styles.stateSub, { color: colors.textMuted }]}>{t('paymentInstructions')}</Text>
        </Animated.View>
      )}

      {state === 'success' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.stateContainer} key="success">
          <Animated.View style={successIconStyle}>
            <CheckCircle size={72} color={colors.success} strokeWidth={1.5} />
          </Animated.View>
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>{t('paymentSuccess')}</Text>
          <Text style={[styles.stateSub, { color: colors.textMuted }]}>{t('preparingOrder')}</Text>
        </Animated.View>
      )}

      {state === 'failed' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.stateContainer} key="failed">
          <XCircle size={72} color={colors.error} strokeWidth={1.5} />
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>{t('paymentFailed')}</Text>
          {errorMessage && (
            <Text style={[styles.stateSub, { color: colors.textMuted }]}>{errorMessage}</Text>
          )}
          <View style={styles.failedActions}>
            <Button onPress={runPayment} variant="primary" size="xl" fullWidth>{t('tryAgain')}</Button>
            <Button onPress={handleCancel} variant="ghost" size="lg" fullWidth>{t('cancel')}</Button>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
    gap: spacing.lg,
  },
  spinner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
  },
  spinnerArc: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  stateTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stateSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
    lineHeight: fontSizes.base * 1.5,
  },
  failedActions: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
