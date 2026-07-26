import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Check } from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useTranslation } from '@/i18n/useTranslation';
import { darkTheme } from '@/theme/themes';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { config } from '@/constants/config';
import { Button } from '@/components/ui/Button';
import type { ScreenProps } from '@/navigation/types';

const { width } = Dimensions.get('window');
const INITIAL_SECONDS = Math.floor(config.autoResetTimeout / 1000);

// This screen is always dark, regardless of the kiosk's light/dark setting —
// it mirrors order-web's thank-you page, which is hard-coded to the dark
// brand background (#060e1d) so the lime accents read as a celebration moment.
const C = darkTheme;

export function ThankYouScreen({ navigation, route }: ScreenProps<'ThankYou'>) {
  const { orderNumber, orderId, customerName } = route.params;
  const cartStore = useCartStore();
  const orderStore = useOrderStore();
  const { t } = useTranslation();

  const [countdown, setCountdown] = useState(INITIAL_SECONDS);
  const isMounted = useRef(true);

  // Customer scans this to open the live order tracker (the order-web
  // /order/[orderId] page) on their own phone. Empty base URL → QR hidden.
  const trackerUrl = config.orderWebUrl ? `${config.orderWebUrl}/order/${orderId}` : '';

  const checkScale = useSharedValue(0);
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 10, stiffness: 150 });
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Clear the cart on mount (not on the checkout screen) so its empty state
  // never flashes during the route transition.
  useEffect(() => {
    cartStore.clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleStartNew = useCallback(() => {
    cartStore.clearCart();
    orderStore.resetOrder();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }, [cartStore, orderStore, navigation]);

  useEffect(() => {
    if (countdown === 0 && isMounted.current) {
      handleStartNew();
    }
  }, [countdown, handleStartNew]);

  const greeting = customerName ? `${t('thankYou')} ${customerName}!` : t('orderConfirmed');

  return (
    <View style={styles.container}>
      {/* Top lime accent line */}
      <View style={styles.accentLine} />

      {/* Ambient lime glow */}
      <View style={styles.glowRing} />

      <View style={styles.content}>
        {/* Check + greeting */}
        <Animated.View entering={FadeInDown.delay(80).duration(600)} style={styles.headSection}>
          <Animated.View style={[styles.checkCircle, checkmarkStyle]}>
            <Check size={44} color={C.primary} strokeWidth={4} />
          </Animated.View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.greetingSub}>{t('orderReceived')}</Text>
          </View>
        </Animated.View>

        {/* Order number */}
        <Animated.View entering={FadeInUp.delay(220).duration(600)} style={styles.orderBlock}>
          <Text style={styles.orderLabel}>{t('orderLabel')}</Text>
          <Text style={styles.orderNumber}>#{orderNumber}</Text>
        </Animated.View>

        {/* Tracker QR */}
        {trackerUrl.length > 0 ? (
          <Animated.View entering={FadeInUp.delay(360).duration(500)} style={styles.qrSection}>
            <Text style={styles.qrTitle}>{t('trackYourOrder')}</Text>
            <View style={styles.qrCard}>
              <QRCode value={trackerUrl} size={168} color="#000000" backgroundColor="#ffffff" />
            </View>
            <Text style={styles.scanText}>{t('scanToTrack')}</Text>
          </Animated.View>
        ) : __DEV__ ? (
          <Animated.View entering={FadeInUp.delay(360).duration(500)} style={styles.qrWarn}>
            <Text style={styles.qrWarnText}>
              Set EXPO_PUBLIC_ORDER_WEB_URL to show the tracker QR here.
            </Text>
          </Animated.View>
        ) : null}

        {/* Wait time */}
        <Animated.Text entering={FadeInUp.delay(460).duration(500)} style={styles.waitText}>
          {t('estimatedWait')}
        </Animated.Text>
      </View>

      {/* Start new order — always available */}
      <Animated.View entering={FadeInUp.delay(560).duration(400)} style={styles.startNewSection}>
        <Button variant="primary" size="xl" fullWidth onPress={handleStartNew}>
          {`${t('startNewOrder')} (${countdown}s)`}
        </Button>
      </Animated.View>

      {/* Brand footer */}
      <Text style={styles.footerText}>
        {t('poweredBy')}
        <Text style={styles.footerBrand}>kiki</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.background,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: C.primary,
  },
  glowRing: {
    position: 'absolute',
    top: -width * 0.6,
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    borderWidth: 1,
    borderColor: C.primary,
    opacity: 0.1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  headSection: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: 'rgba(204,255,0,0.12)',
  },
  greetingBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  orderBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  orderNumber: {
    fontFamily: fonts.heading,
    fontSize: 64,
    lineHeight: 70,
    color: C.primary,
    letterSpacing: -1.5,
  },
  qrSection: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  qrTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
  },
  scanText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 220,
  },
  qrWarn: {
    borderWidth: 1.5,
    borderColor: C.error,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  qrWarnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: C.error,
    textAlign: 'center',
    maxWidth: 240,
  },
  waitText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  startNewSection: {
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  footerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  footerBrand: {
    fontFamily: fonts.heading,
    color: C.primary,
    letterSpacing: -0.4,
  },
});
