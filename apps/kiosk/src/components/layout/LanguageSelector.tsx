import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Globe } from 'lucide-react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { useLanguageModalStore } from '@/store/useLanguageModalStore';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

interface LanguageSelectorProps {
  variant?: 'full' | 'compact';
}

export function LanguageSelector({ variant = 'full' }: LanguageSelectorProps) {
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const open = useLanguageModalStore((s) => s.open);

  return (
    <TouchableOpacity
      style={[
        styles.trigger,
        { backgroundColor: colors.surfaceContainer },
        variant === 'compact' && styles.triggerCompact,
      ]}
      onPress={open}
      activeOpacity={0.7}
    >
      <Globe size={18} color={colors.textPrimary} strokeWidth={2} />
      {variant === 'full' ? (
        <Text style={[styles.triggerText, { color: colors.textPrimary }]}>
          {t('selectLanguage')}
        </Text>
      ) : (
        <Text style={[styles.triggerTextCompact, { color: colors.textPrimary }]}>
          {language.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  triggerCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  triggerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.3,
  },
  triggerTextCompact: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
