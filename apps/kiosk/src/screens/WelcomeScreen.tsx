import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useThemeStore } from '@/store/useThemeStore';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

const { width } = Dimensions.get('window');

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { colors, isDark } = useTheme();
  const { toggleTheme } = useThemeStore();

  // Hidden 5-tap theme toggle
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapFlash, setTapFlash] = useState(false);

  const handleLogoTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      toggleTheme();
      setTapFlash(true);
      setTimeout(() => setTapFlash(false), 300);
    }
  };

  // Pulse glow on CTA
  const glow = useSharedValue(0.6);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600 }),
        withTiming(0.6, { duration: 1600 })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subtle top accent line */}
      <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Wordmark */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(700).springify()}
          style={styles.logoSection}
        >
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
            <View style={[styles.wordmarkContainer, tapFlash && { opacity: 0.7 }]}>
              <Text style={[styles.wordmark, { color: colors.textPrimary }]}>KIKI</Text>
              <View style={[styles.wordmarkBar, { backgroundColor: colors.primary }]} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Order · Dine · Enjoy
          </Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(700).springify()}
          style={styles.ctaSection}
        >
          {/* Glow behind button */}
          <Animated.View style={[styles.buttonGlow, { backgroundColor: colors.primary }, glowStyle]} />

          <TouchableOpacity
            onPress={() => navigation.navigate('OrderType')}
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
              Start Your Order
            </Text>
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.textMuted }]}>Tap to begin</Text>
        </Animated.View>
      </View>

      {/* Brand footer */}
      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.footer}
      >
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Powered by{' '}
          <Text style={{ color: colors.primary, fontFamily: fonts.bodyBold }}>
            Kiki
          </Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing['4xl'],
  },
  logoSection: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  wordmarkContainer: {
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 80,
  },
  wordmarkBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  ctaSection: {
    alignItems: 'center',
    width: '100%',
    gap: spacing.base,
  },
  buttonGlow: {
    position: 'absolute',
    top: -8,
    width: width * 0.72,
    height: 72,
    borderRadius: 36,
    opacity: 0.25,
  },
  ctaButton: {
    width: '85%',
    height: 68,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.3,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    letterSpacing: 1,
  },
  footer: {
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
  },
});
