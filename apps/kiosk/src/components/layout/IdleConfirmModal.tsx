import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Clock } from 'lucide-react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 400);

interface IdleConfirmModalProps {
  visible: boolean;
  secondsLeft: number;
  onConfirm: () => void;
}

// Deliberately no backdrop-dismiss (unlike LanguageModal) — a stray tap
// outside the card must not silently cancel the check. Only the explicit
// "Sí, sigo aquí" button counts as confirmation (see useIdleGuard).
export function IdleConfirmModal({ visible, secondsLeft, onConfirm }: IdleConfirmModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1A' }]}>
            <Clock size={32} color={colors.primary} strokeWidth={2} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('idleCheckTitle')}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t('idleCheckBody')} {secondsLeft}s
          </Text>

          <TouchableOpacity
            onPress={onConfirm}
            activeOpacity={0.85}
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.confirmText, { color: colors.onPrimary }]}>{t('idleCheckConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.xl,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmBtn: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.lg,
  },
});
