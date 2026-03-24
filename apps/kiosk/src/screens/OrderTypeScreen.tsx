import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useOrderStore } from '@/store/useOrderStore';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';
import type { OrderType } from '@/data/types';

const options: { type: OrderType; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
  {
    type: 'dine-in',
    icon: 'restaurant-outline',
    title: 'Dine In',
    subtitle: 'Eat at the restaurant',
  },
  {
    type: 'takeaway',
    icon: 'bag-handle-outline',
    title: 'Takeaway',
    subtitle: 'Take your order to go',
  },
];

export function OrderTypeScreen({ navigation }: ScreenProps<'OrderType'>) {
  const setOrderType = useOrderStore((s) => s.setOrderType);

  const handleSelect = (type: OrderType) => {
    setOrderType(type);
    navigation.navigate('Menu');
  };

  return (
    <ScreenWrapper>
      <Header title="" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <Animated.Text
          entering={FadeInDown.delay(100).duration(600)}
          style={styles.heading}
        >
          How are you{'\n'}dining today?
        </Animated.Text>

        <View style={styles.cardsRow}>
          {options.map((opt, i) => (
            <Animated.View
              key={opt.type}
              entering={FadeInUp.delay(300 + i * 150).duration(600).springify()}
              style={styles.cardWrapper}
            >
              <AnimatedPressable
                onPress={() => handleSelect(opt.type)}
                style={styles.card}
                scaleValue={0.95}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={opt.icon} size={48} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>{opt.title}</Text>
                <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
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
    paddingBottom: spacing['4xl'],
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['3xl'],
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    lineHeight: 48,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
