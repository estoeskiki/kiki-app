import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useThemeStore } from '@/store/useThemeStore';
import { useTranslation } from '@/i18n/useTranslation';
import { useRestaurantStore } from '@/store/useRestaurantStore';
import { useAuthStore } from '@/store/useAuthStore';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

function getMediaType(url: string): 'video' | 'image' | null {
  if (!url) return null;
  if (/\.(mp4|mov|webm)$/i.test(url)) return 'video';
  return 'image';
}

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { toggleTheme } = useThemeStore();
  const { t } = useTranslation();
  const { profile } = useRestaurantStore();
  const mode = useAuthStore((s) => s.mode);
  const mediaType = getMediaType(profile?.welcomeBgUrl ?? '');

  // No upfront order-type picker anymore (moved to checkout, matching
  // order-web). Food courts go to the restaurant directory, standalone
  // restaurants straight to the menu.
  const handleStart = () => {
    navigation.navigate(mode === 'food_court' ? 'Directory' : 'Menu');
  };
  const hasMedia = mediaType !== null;

  const videoPlayer = useVideoPlayer(
    mediaType === 'video' ? { uri: profile!.welcomeBgUrl } : null,
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  );

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

  // Pulsing glow behind the CTA. reverse=true ping-pongs the timing for a
  // seamless loop with no jump at the ends. The glow is ONE pill sized to the
  // button (see buttonGlow) — the earlier version keyed its width off the
  // screen width, so it blew far past the button on a large kiosk display while
  // looking fine on a small simulator; anchoring it to the button keeps it
  // proportional on every screen. Opacity + a slight scale make it breathe.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  // Ripple rings — an outlined (not filled) pill so it can only ever draw a
  // thin line, never band into a solid slab. Two rings staggered by half the
  // cycle so a new one starts expanding as the other is still fading, giving
  // a continuous "radar ping" pulse instead of a single one-shot ripple.
  // reverse=false makes each a sawtooth: expand+fade, snap back, repeat.
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  useEffect(() => {
    ripple1.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
    ripple2.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false)
    );
  }, []);

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: (1 - ripple1.value) * 0.55,
    transform: [{ scale: 1 + ripple1.value * 0.45 }],
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    opacity: (1 - ripple2.value) * 0.55,
    transform: [{ scale: 1 + ripple2.value * 0.45 }],
  }));

  const textColor = hasMedia ? '#ffffff' : colors.textPrimary;
  const mutedColor = hasMedia ? 'rgba(255,255,255,0.7)' : colors.textMuted;
  // On a plain (no photo) background, "kiki" in lime is unreadable against a
  // light theme's near-white surface — fall back to solid textPrimary there.
  const footerMutedColor = hasMedia ? 'rgba(255,255,255,0.5)' : isDark ? colors.textMuted : colors.textPrimary;
  const footerBrandColor = hasMedia ? colors.primary : isDark ? colors.primary : colors.textPrimary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background media */}
      {mediaType === 'video' && (
        <VideoView
          player={videoPlayer}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      )}
      {mediaType === 'image' && (
        <Image
          source={profile!.welcomeBgUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}
      {hasMedia && (
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Subtle top accent line */}
      <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

      {/* Language Selector (Top Right) */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(500)}
        style={[styles.langToggleContainer, { top: Math.max(insets.top, 20) + 16 }]}
      >
        <LanguageSelector variant="full" />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {/* Wordmark */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(700).springify()}
          style={styles.logoSection}
        >
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{t('welcomeTo')}</Text>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
            <View style={[styles.wordmarkContainer, tapFlash && { opacity: 0.7 }]}>
              <Text
                style={[styles.wordmark, { color: textColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.35}
              >
                {profile?.name ?? 'KIKI'}
              </Text>
              <View style={[styles.wordmarkBar, { backgroundColor: colors.primary }]} />
            </View>
          </TouchableOpacity>
          {(profile?.slogan || !profile) && (
            <Text style={[styles.tagline, { color: mutedColor }]}>
              {profile?.slogan || 'Order · Dine · Enjoy'}
            </Text>
          )}
        </Animated.View>

        {/* CTA */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(700).springify()}
          style={styles.ctaSection}
        >
          <View style={styles.ctaWrapper}>
            {/* Single soft glow, sized to the button so it stays proportional
                on any screen (small simulator → large kiosk) */}
            <Animated.View
              pointerEvents="none"
              style={[styles.buttonGlow, { backgroundColor: colors.primary }, glowStyle]}
            />
            {/* Ripple rings — outlined only, so they read as an expanding
                "radar ping" instead of a filled shape that could band */}
            <Animated.View
              pointerEvents="none"
              style={[styles.rippleRing, { borderColor: colors.primary }, ripple1Style]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.rippleRing, { borderColor: colors.primary }, ripple2Style]}
            />
            <TouchableOpacity
              onPress={handleStart}
              style={[styles.ctaButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
                {t('startOrder')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Brand footer */}
      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.footer}
      >
        <Text style={[styles.footerText, { color: footerMutedColor }]}>
          {t('poweredBy')}
          <Text style={{ color: footerBrandColor, fontFamily: fonts.heading, letterSpacing: -0.4 }}>
            kiki
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
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.lg,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  wordmarkContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    textAlign: 'center',
  },
  wordmarkBar: {
    width: 56,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.md,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    fontStyle: 'italic',
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: 320,
  },
  ctaSection: {
    alignItems: 'center',
    width: '100%',
  },
  ctaWrapper: {
    width: '85%',
    maxWidth: 340,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGlow: {
    position: 'absolute',
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    borderRadius: borderRadius.xl + 14,
  },
  rippleRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  ctaButton: {
    width: '100%',
    height: '100%',
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
  footer: {
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: -0.2,
  },
  langToggleContainer: {
    position: 'absolute',
    top: spacing['2xl'],
    right: spacing.lg,
    zIndex: 10,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  langToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.5,
  },
  langToggleSeparator: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    marginHorizontal: 2,
  },
});
