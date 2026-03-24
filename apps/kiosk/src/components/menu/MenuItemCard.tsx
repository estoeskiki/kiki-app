import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import type { MenuItem } from '@/data/types';

interface MenuItemCardProps {
  item: MenuItem;
  onPress: () => void;
  onQuickAdd: () => void;
}

/**
 * Array of dark muted placeholder colors for item thumbnails.
 */
const PLACEHOLDER_COLORS = [
  '#5C2D0E', // dark orange-brown
  '#1B3A4B', // dark blue
  '#1A3C2B', // dark green
  '#3B1F3B', // dark purple
  '#4A2C1A', // dark sienna
  '#2A2D4E', // dark indigo
  '#3D2B1F', // dark coffee
  '#1F3B3D', // dark teal
] as const;

/**
 * Simple hash to pick a deterministic color from the palette based on item id.
 */
function getPlaceholderColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[index];
}

/**
 * Pick a representative emoji for the item. Uses a simple food emoji
 * based on categoryId prefix, with a generic fallback.
 */
const CATEGORY_EMOJI: Record<string, string> = {
  'cat-burgers': '\uD83C\uDF54',
  'cat-sides': '\uD83C\uDF5F',
  'cat-drinks': '\uD83E\uDD64',
  'cat-desserts': '\uD83C\uDF70',
  'cat-combos': '\u2B50',
};

function getItemEmoji(categoryId: string): string {
  return CATEGORY_EMOJI[categoryId] ?? '\uD83C\uDF7D\uFE0F';
}

export function MenuItemCard({ item, onPress, onQuickAdd }: MenuItemCardProps) {
  const bgColor = getPlaceholderColor(item.id);
  const emoji = getItemEmoji(item.categoryId);

  return (
    <AnimatedPressable style={styles.card} onPress={onPress} scaleValue={0.97}>
      {/* Image placeholder */}
      <View style={[styles.imagePlaceholder, { backgroundColor: bgColor }]}>
        <Text style={styles.emoji}>{emoji}</Text>

        {/* Popular badge */}
        {item.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>POPULAR</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.price}>{formatCurrency(item.price)}</Text>

          {/* Quick-add button */}
          <Pressable
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: fontSizes.sm * 1.4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  price: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
