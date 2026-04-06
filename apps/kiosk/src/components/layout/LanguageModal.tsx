import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { X, Check } from 'lucide-react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { useLanguageModalStore } from '@/store/useLanguageModalStore';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { Language } from '@/i18n/translations';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 400);

export function LanguageModal() {
  const { t, language, setLanguage } = useTranslation();
  const { colors } = useTheme();
  const { visible, close } = useLanguageModalStore();

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    close();
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}
    >
      <View style={styles.overlay}>
        {/* Background dismiss */}
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={close} 
        />

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.background }]}>  
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('selectLanguage')}
            </Text>
            <TouchableOpacity onPress={close} style={[styles.closeBtn, { backgroundColor: colors.surfaceContainer }]} activeOpacity={0.7}>
              <X size={20} color={colors.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Español */}
          <TouchableOpacity
            style={[
              styles.option,
              { borderColor: language === 'es' ? colors.primary : colors.borderLight, backgroundColor: colors.surface },
            ]}
            onPress={() => handleSelect('es')}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.flag}>🇪🇸</Text>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>Español</Text>
            </View>
            {language === 'es' && <Check size={20} color={colors.primary} strokeWidth={3} />}
          </TouchableOpacity>

          {/* English */}
          <TouchableOpacity
            style={[
              styles.option,
              { borderColor: language === 'en' ? colors.primary : colors.borderLight, backgroundColor: colors.surface },
              { marginTop: spacing.md },
            ]}
            onPress={() => handleSelect('en')}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.flag}>🇺🇸</Text>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>English</Text>
            </View>
            {language === 'en' && <Check size={20} color={colors.primary} strokeWidth={3} />}
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
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.xl,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderRadius: borderRadius.xl,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flag: {
    fontSize: 24,
  },
  optionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.lg,
  },
});
