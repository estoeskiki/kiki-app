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
  // When set, renders as a labeled pill (icon + text) instead of an icon-only
  // circle — the bare RotateCcw ("undo") icon reads as unclear on its own,
  // so the restart action always passes a label.
  label?: string;
}

interface HeaderProps {
  title: string;
  onBack?: () => void;
  // When set, onBack renders as a labeled pill instead of a bare chevron —
  // used specifically where "back" means returning to the restaurant catalog,
  // so the label can say that explicitly rather than leave it ambiguous.
  backLabel?: string;
  rightAction?: RightAction;
  secondaryRightAction?: RightAction;
}

export function Header({ title, onBack, backLabel, rightAction, secondaryRightAction }: HeaderProps) {
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
    // restart icon — always labeled (see RightAction.label)
    if (action.label) {
      return (
        <AnimatedPressable
          key="restart"
          onPress={action.onPress}
          style={[styles.pillBtn, { backgroundColor: colors.surfaceContainer }]}
        >
          <RotateCcw size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
            {action.label}
          </Text>
        </AnimatedPressable>
      );
    }
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
        {onBack && (backLabel ? (
          <AnimatedPressable
            onPress={onBack}
            style={[styles.pillBtn, { backgroundColor: colors.surfaceContainer }]}
          >
            <ChevronLeft size={18} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={[styles.pillText, { color: colors.textPrimary }]} numberOfLines={1}>
              {backLabel}
            </Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={onBack}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
          >
            <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        ))}
        <LanguageSelector variant="compact" />
      </View>

      <View pointerEvents="none" style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.right}>
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
  pillBtn: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
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
