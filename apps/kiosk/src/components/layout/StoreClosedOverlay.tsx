import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Store } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export function StoreClosedOverlay() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View 
      entering={FadeIn.duration(400)} 
      exiting={FadeOut.duration(300)}
      style={[
        StyleSheet.absoluteFill, 
        styles.container, 
        { backgroundColor: colors.overlay }
      ]}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Store size={64} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Cerrados al momento
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Por favor, vuelve más tarde o pregunta a un empleado.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  card: {
    padding: spacing['3xl'],
    borderRadius: 32,
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 500,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['3xl'],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xl,
    textAlign: 'center',
    lineHeight: fontSizes.xl * 1.4,
  },
});
