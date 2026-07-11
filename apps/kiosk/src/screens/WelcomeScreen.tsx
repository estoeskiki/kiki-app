import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useThemeStore } from '@/store/useThemeStore';
import { useTranslation } from '@/i18n/useTranslation';
import { useRestaurantStore } from '@/store/useRestaurantStore';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

const { width } = Dimensions.get('window');

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
  const mediaType = getMediaType(profile?.welcomeBgUrl ?? '');
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

  const textColor = hasMedia ? '#ffffff' : colors.textPrimary;
  const mutedColor = hasMedia ? 'rgba(255,255,255,0.75)' : colors.textMuted;

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
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
            <View style={[styles.wordmarkContainer, tapFlash && { opacity: 0.7 }]}>
              <Text style={[styles.wordmark, { color: textColor }]}>{profile?.name ?? 'KIKI'}</Text>
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
          {/* Glow behind button */}
          <Animated.View style={[styles.buttonGlow, { backgroundColor: colors.primary }, glowStyle]} />

          <TouchableOpacity
            onPress={() => navigation.navigate('OrderType')}
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
              {t('startOrder')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.hint, { color: mutedColor }]}>{t('welcome')}</Text>
        </Animated.View>
      </View>

      {/* Brand footer */}
      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.footer}
      >
        <Text style={[styles.footerText, { color: mutedColor }]}>
          {t('poweredBy')}
          <Text style={{ color: colors.primary, fontFamily: fonts.heading, letterSpacing: -0.4 }}>
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
