import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { UtensilsCrossed, ShoppingBag } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useOrderStore } from '@/store/useOrderStore';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';
import type { OrderType } from '@/data/types';

// Options moved inside component to access translations

function OptionIcon({ icon, color }: { icon: 'dine' | 'take'; color: string }) {
  if (icon === 'dine') return <UtensilsCrossed size={40} color={color} strokeWidth={1.5} />;
  return <ShoppingBag size={40} color={color} strokeWidth={1.5} />;
}

export function OrderTypeScreen({ navigation }: ScreenProps<'OrderType'>) {
  const setOrderType = useOrderStore((s) => s.setOrderType);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const options: {
    type: OrderType;
    icon: 'dine' | 'take';
    title: string;
    subtitle: string;
  }[] = [
    { type: 'dine-in', icon: 'dine', title: t('dineIn'), subtitle: t('dineInSub') },
    { type: 'takeaway', icon: 'take', title: t('takeaway'), subtitle: t('takeawaySub') },
  ];

  const handleSelect = (type: OrderType) => {
    setOrderType(type);
    navigation.navigate('Menu');
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(80).duration(600)} style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{t('welcome')}</Text>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            {t('chooseOrderType')}
          </Text>
        </Animated.View>

        <View style={styles.cardsRow}>
          {options.map((opt, i) => (
            <Animated.View
              key={opt.type}
              entering={FadeInUp.delay(250 + i * 120).duration(600).springify()}
              style={styles.cardWrapper}
            >
              <AnimatedPressable
                onPress={() => handleSelect(opt.type)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                scaleValue={0.96}
              >
                <View style={[styles.iconRing, { backgroundColor: colors.surfaceContainer }]}>
                  <OptionIcon icon={opt.icon} color={colors.textPrimary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{opt.title}</Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>{opt.subtitle}</Text>
                <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
              </AnimatedPressable>
            </Animated.View>
          ))}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['3xl'],
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: fontSizes['3xl'] * 1.15,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    gap: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.4,
  },
  cardSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
