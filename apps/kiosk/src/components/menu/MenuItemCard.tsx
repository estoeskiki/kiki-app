import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import type { MenuItem } from '@/data/types';

interface MenuItemCardProps {
  item: MenuItem;
  onPress: () => void;
  onQuickAdd: () => void;
}

// Soft pastel branded backgrounds (readable in light mode)
const LIGHT_PLATE_COLORS = [
  '#eef3ff', // soft blue
  '#f0fff4', // soft green
  '#fff4f0', // soft peach
  '#f9f0ff', // soft lavender
  '#f0fffe', // soft teal
  '#fffbf0', // soft amber
  '#fff0f5', // soft pink
  '#f0f7ff', // soft periwinkle
] as const;

// Deeper brand surface tones for dark mode
const DARK_PLATE_COLORS = [
  '#0a1730', '#0a2a1a', '#1a0a00', '#180a30',
  '#001a2a', '#1a1800', '#2a0a18', '#0a1820',
] as const;

function getPlateColor(id: string, isDark: boolean): string {
  const palette = isDark ? DARK_PLATE_COLORS : LIGHT_PLATE_COLORS;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function MenuItemCard({ item, onPress, onQuickAdd }: MenuItemCardProps) {
  const { colors, isDark } = useTheme();
  const bgColor = getPlateColor(item.id, isDark);

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
      onPress={onPress}
      scaleValue={0.97}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbnail, { backgroundColor: bgColor }]}>
        <Text style={[styles.initial, { color: colors.textSecondary }]}>
          {getInitial(item.name)}
        </Text>
        {item.popular && (
          <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.popularText, { color: colors.onPrimary }]}>★</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.price, { color: colors.textPrimary }]}>
            {formatCurrency(item.price)}
          </Text>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Plus size={18} color={colors.onPrimary} strokeWidth={3} />
          </Pressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['4xl'],
    fontWeight: '900',
    opacity: 0.25,
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.base,
    letterSpacing: -0.2,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  price: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.base,
    letterSpacing: -0.2,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
