import { View, Text, StyleSheet, Alert } from 'react-native';
import { ChevronLeft, ShoppingCart, RotateCcw } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { LanguageSelector } from './LanguageSelector';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface RightAction {
  icon: 'cart' | 'restart';
  onPress: () => void;
  badge?: number;
}

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: RightAction;
  secondaryRightAction?: RightAction;
}

export function Header({ title, onBack, rightAction, secondaryRightAction }: HeaderProps) {
  const { colors } = useTheme();

  function renderIcon(action: RightAction) {
    if (action.icon === 'cart') {
      return (
        <AnimatedPressable
          key="cart"
          onPress={action.onPress}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
        >
          <ShoppingCart size={20} color={colors.textPrimary} strokeWidth={2} />
          {action.badge !== undefined && action.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                {action.badge > 99 ? '99+' : action.badge}
              </Text>
            </View>
          )}
        </AnimatedPressable>
      );
    }
    // restart icon
    return (
      <AnimatedPressable
        key="restart"
        onPress={action.onPress}
        style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
      >
        <RotateCcw size={18} color={colors.textSecondary} strokeWidth={2} />
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
      <View style={styles.left}>
        {onBack && (
          <AnimatedPressable
            onPress={onBack}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
          >
            <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        )}
        <LanguageSelector variant="compact" />
      </View>

      <View pointerEvents="none" style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={[styles.right, { width: secondaryRightAction ? 96 : 44 }]}>
        {secondaryRightAction && renderIcon(secondaryRightAction)}
        {rightAction && renderIcon(rightAction)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  right: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.lg,
    textAlign: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
  },
});
