import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

const { width, height } = Dimensions.get('window');

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#1A0A00', '#0A0A0A', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      {/* Content */}
      <View style={styles.content}>
        {/* Logo area */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(800).springify()}
          style={styles.logoSection}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🍔</Text>
          </View>
          <Text style={styles.brandName}>KIKI</Text>
          <Text style={styles.brandSub}>BURGER</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Smashed to Perfection</Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(800).springify()}
          style={styles.ctaSection}
        >
          {/* Glow behind button */}
          <Animated.View style={[styles.buttonGlow, glowStyle]} />

          <AnimatedPressable
            onPress={() => navigation.navigate('OrderType')}
            style={styles.ctaButton}
            scaleValue={0.95}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaText}>Start Your Order</Text>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </LinearGradient>
          </AnimatedPressable>

          <Text style={styles.touchPrompt}>Tap to begin</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  decorCircle1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
    opacity: 0.04,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.secondary,
    opacity: 0.03,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['5xl'],
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoEmoji: {
    fontSize: 56,
  },
  brandName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['5xl'],
    color: colors.textPrimary,
    letterSpacing: 8,
    lineHeight: 68,
  },
  brandSub: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.primary,
    letterSpacing: 12,
    marginTop: -4,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.primary,
    marginVertical: spacing.lg,
    borderRadius: 1,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  ctaSection: {
    alignItems: 'center',
    width: '100%',
  },
  buttonGlow: {
    position: 'absolute',
    top: -10,
    width: width * 0.7,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    opacity: 0.15,
    // blur effect via shadow on iOS/Android
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  ctaButton: {
    width: '85%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  ctaText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  touchPrompt: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.base,
    letterSpacing: 1,
  },
});
