import { View, Text, StyleSheet } from 'react-native';
import Animated, { Layout, FadeOut } from 'react-native-reanimated';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import type { CartItem } from '@/data/types';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

function formatCustomizations(item: CartItem, localize: (val: any) => string): string {
  const names: string[] = [];
  for (const group of item.menuItem.customizations) {
    const selectedIds = item.selectedCustomizations[group.id] ?? [];
    for (const option of group.options) {
      if (selectedIds.includes(option.id)) {
        names.push(localize(option.name));
      }
    }
  }
  return names.join(' · ');
}

// A clean, deterministic branded gradient using item id
function getMonoColor(id: string): string {
  const palette = [
    '#e8f0fe', '#fce8ff', '#e8fff0', '#fff8e8',
    '#e8f8ff', '#ffe8ea', '#f0e8ff', '#e8fffd',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const { colors } = useTheme();
  const { localize } = useTranslation();
  const customizationText = formatCustomizations(item, localize);
  const bgColor = getMonoColor(item.id);

  return (
    <Animated.View
      layout={Layout.springify().damping(18).stiffness(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
    >
      {/* Item thumbnail */}
      <View style={[styles.thumbnail, { backgroundColor: bgColor }]}>
        <Text style={[styles.thumbnailInitial, { color: colors.textSecondary }]}>
          {getInitial(localize(item.menuItem.name))}
        </Text>
      </View>

      {/* Center info */}
      <View style={styles.center}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {localize(item.menuItem.name)}
        </Text>
        {customizationText.length > 0 && (
          <Text style={[styles.customizations, { color: colors.textMuted }]} numberOfLines={2}>
            {customizationText}
          </Text>
        )}
        <Text style={[styles.lineTotal, { color: colors.textPrimary }]}>
          {formatCurrency(item.lineTotal)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.right}>
        <View style={[styles.qtyRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}>
          <AnimatedPressable
            onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
            style={styles.qtyBtn}
          >
            <Minus size={14} color={colors.textSecondary} strokeWidth={2.5} />
          </AnimatedPressable>
          <Text style={[styles.qtyText, { color: colors.textPrimary }]}>{item.quantity}</Text>
          <AnimatedPressable
            onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
            style={styles.qtyBtn}
          >
            <Plus size={14} color={colors.textSecondary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
        <AnimatedPressable onPress={() => onRemove(item.id)} style={styles.removeBtn}>
          <Trash2 size={16} color={colors.error} strokeWidth={2} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailInitial: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    marginHorizontal: spacing.md,
    gap: 2,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  customizations: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  lineTotal: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  right: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    height: 36,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    minWidth: 22,
    textAlign: 'center',
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
