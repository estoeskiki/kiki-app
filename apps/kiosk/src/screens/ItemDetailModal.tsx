import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Minus, Plus, ChevronDown } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/store/useCartStore';
import { useTheme } from '@/context/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { formatCurrency } from '@/utils/formatCurrency';
import { mediumTap } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTranslation } from '@/i18n/useTranslation';
import type { ScreenProps } from '@/navigation/types';
import type { CustomizationGroup } from '@/data/types';

// Soft plate colors for item hero
const LIGHT_PLATES = [
  '#eef3ff', '#f0fff4', '#fff4f0', '#f9f0ff',
  '#f0fffe', '#fffbf0', '#fff0f5', '#f0f7ff',
] as const;
const DARK_PLATES = [
  '#0a1730', '#0a2a1a', '#1a0a00', '#180a30',
  '#001a2a', '#1a1800', '#2a0a18', '#0a1820',
] as const;

function getPlateColor(id: string, isDark: boolean): string {
  const p = isDark ? DARK_PLATES : LIGHT_PLATES;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

export function ItemDetailModal({ navigation, route }: ScreenProps<'ItemDetail'>) {
  const { item, restaurantId, restaurantName } = route.params;
  const addItem = useCartStore((s) => s.addItem);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t, localize } = useTranslation();
  // Modal is a fixed 65% of the screen — the hero image + name/price header
  // stay fully visible (never scrolled away, never cropped); only the
  // customization list scrolls, and only once it outgrows what's left.
  const { height: windowHeight } = useWindowDimensions();
  const cardHeight = windowHeight * 0.65;
  const heroHeight = cardHeight * 0.4;

  // Bottom edge-fade hint: tells the user there's more to scroll without any
  // extra chrome. Opacity is driven by how close to the bottom they are —
  // full strength while there's a full "page" left, easing to 0 right as the
  // last bit of content comes into view, instead of a hard on/off flicker.
  // Driven entirely by Reanimated shared values on the UI thread — an earlier
  // version tracked this via React state updated on every onScroll event,
  // which re-rendered the whole modal (including the full customization list)
  // on every scroll frame and could lock up/crash on the kiosk's hardware.
  const contentHeightSV = useSharedValue(0);
  const layoutHeightSV = useSharedValue(0);
  const scrollYSV = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollYSV.value = event.contentOffset.y;
  });
  const scrollFadeStyle = useAnimatedStyle(() => {
    const remaining = contentHeightSV.value - layoutHeightSV.value - scrollYSV.value;
    return { opacity: Math.min(1, Math.max(0, remaining / 24)) };
  });

  // "Más opciones abajo" pill — a more obvious companion to the fade (a fade
  // alone read as too subtle). Same fade-out math as scrollFadeStyle so both
  // disappear together right at the bottom; a gentle up/down bounce (not a
  // one-shot animation) keeps drawing the eye for as long as it's shown.
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, []);
  const scrollHintStyle = useAnimatedStyle(() => {
    const remaining = contentHeightSV.value - layoutHeightSV.value - scrollYSV.value;
    return {
      opacity: Math.min(1, Math.max(0, remaining / 24)),
      transform: [{ translateY: bounce.value * 5 }],
    };
  });

  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of item.customizations) init[g.id] = [];
    return init;
  });
  const [quantity, setQuantity] = useState(1);

  const handleToggleOption = useCallback((group: CustomizationGroup, optionId: string) => {
    setSelectedCustomizations((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelections === 1) {
        if (current.includes(optionId) && !group.required) return { ...prev, [group.id]: [] };
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      if (current.length >= group.maxSelections) return { ...prev, [group.id]: [...current.slice(1), optionId] };
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }, []);

  const modifierTotal = useMemo(() => {
    let total = 0;
    for (const g of item.customizations) {
      const ids = selectedCustomizations[g.id] ?? [];
      for (const opt of g.options) { if (ids.includes(opt.id)) total += opt.priceModifier; }
    }
    return total;
  }, [item.customizations, selectedCustomizations]);

  const lineTotal = (item.price + modifierTotal) * quantity;

  const canAdd = useMemo(() => {
    for (const g of item.customizations) {
      if (g.required && (selectedCustomizations[g.id] ?? []).length === 0) return false;
    }
    return true;
  }, [item.customizations, selectedCustomizations]);

  const handleAddToCart = useCallback(() => {
    if (!canAdd) return;
    mediumTap();
    addItem(item, quantity, selectedCustomizations, restaurantId, restaurantName);
    navigation.goBack();
  }, [canAdd, addItem, item, quantity, selectedCustomizations, navigation, restaurantId, restaurantName]);

  const heroColor = getPlateColor(item.id, isDark);
  const initial = localize(item.name).trim().charAt(0).toUpperCase();

  return (
    <View style={styles.overlay}>
      {/* Backdrop — a sibling behind the card, not an ancestor of it, so a
          tap on the card never bubbles down to this and closes the sheet. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />

      <View style={[styles.card, { backgroundColor: colors.background, height: cardHeight }]}>
        {/* Everything scrolls together (image included) — simpler than a
            separate fixed header, and the image scrolling away is fine.
            minHeight: 0 is required: a flex:1 child's default min-height is
            "auto" (its content size), so without it the ScrollView grows to
            fit ALL the content instead of being clipped to the fixed card
            height — which is what made it un-scrollable in the first place. */}
        {/* Wrapper bounds the ScrollView so the fade below can anchor its
            "bottom: 0" to the actual bottom edge of the scroll area, not the
            whole card — otherwise it'd float over the fixed bottom bar. */}
        <View style={styles.scrollWrapper}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onLayout={(e) => { layoutHeightSV.value = e.nativeEvent.layout.height; }}
          onContentSizeChange={(_w, h) => { contentHeightSV.value = h; }}
        >
          {/* Hero — contentFit="contain" (not "cover") so the whole photo is
              always visible regardless of its aspect ratio; the plate color
              letterboxes around it instead of cropping a tall product shot. */}
          <View style={[styles.hero, { backgroundColor: heroColor, height: heroHeight }]}>
            {item.image ? (
              <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={150} />
            ) : (
              <Text style={[styles.heroInitial, { color: colors.textSecondary, opacity: 0.2 }]}>{initial}</Text>
            )}
            {item.popular && (
              <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.popularText, { color: colors.onPrimary }]}>★ {t('popular')}</Text>
              </View>
            )}
          </View>

          <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.detailsHeader}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]}>{localize(item.name)}</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>{localize(item.description)}</Text>
            <Text style={[styles.basePrice, { color: colors.textPrimary }]}>{formatCurrency(item.price)}</Text>
          </Animated.View>

          {item.customizations.map((group) => (
            <View key={group.id} style={[styles.groupContainer, { borderTopColor: colors.borderLight }]}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: colors.textPrimary }]}>{localize(group.name)}</Text>
                {group.required && (
                  <View style={[styles.requiredBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.requiredText, { color: colors.onPrimary }]}>{t('required')}</Text>
                  </View>
                )}
                {!group.required && group.maxSelections > 1 && (
                  <View style={[styles.requiredBadge, { backgroundColor: colors.surfaceContainer }]}>
                    <Text style={[styles.requiredText, { color: colors.textSecondary }]}>{t('upTo')} {group.maxSelections}</Text>
                  </View>
                )}
              </View>

              {group.options.map((option) => {
                const isSelected = (selectedCustomizations[group.id] ?? []).includes(option.id);
                const isRadio = group.maxSelections === 1;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.borderLight,
                      },
                    ]}
                    onPress={() => handleToggleOption(group, option.id)}
                  >
                    <View style={[
                      isRadio ? styles.radio : styles.checkbox,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { backgroundColor: colors.primary },
                    ]}>
                      {isSelected && !isRadio && (
                        <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '800' }}>✓</Text>
                      )}
                      {isSelected && isRadio && (
                        <View style={[styles.radioDot, { backgroundColor: colors.onPrimary }]} />
                      )}
                    </View>
                    <Text style={[styles.optionName, { color: isSelected ? colors.textPrimary : colors.textSecondary }]}>
                      {localize(option.name)}
                    </Text>
                    {option.priceModifier !== 0 && (
                      <Text style={[styles.optionPrice, { color: isSelected ? colors.textPrimary : colors.textMuted }]}>
                        {option.priceModifier > 0 ? '+' : ''}{formatCurrency(option.priceModifier)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.ScrollView>

        {/* "More below" hint — fades to the card background right where the
            scroll area ends, and fades itself out as the user nears the
            bottom. pointerEvents="none" so it never blocks scroll/taps.
            Opacity is animated on the UI thread (scrollFadeStyle) — the
            gradient itself always renders at full strength; the wrapping
            Animated.View is what actually fades in/out. */}
        <Animated.View pointerEvents="none" style={[styles.scrollFade, scrollFadeStyle]}>
          <LinearGradient colors={['transparent', colors.background]} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Obvious "more below" pill — sits on top of the fade, bounces gently
            to draw the eye, and fades out together with it at the bottom. */}
        <Animated.View pointerEvents="none" style={[styles.scrollHint, scrollHintStyle]}>
          <View style={[styles.scrollHintPill, { backgroundColor: colors.primary }]}>
            <Text style={[styles.scrollHintText, { color: colors.onPrimary }]}>{t('scrollForMore')}</Text>
            <ChevronDown size={14} color={colors.onPrimary} strokeWidth={2.5} />
          </View>
        </Animated.View>
        </View>

      {/* Close button — a sibling of the ScrollView (not inside it), so it
          stays pinned to the top of the modal card and never scrolls away
          even though the hero image now scrolls with everything else. */}
      <Pressable
        style={[styles.closeBtn, { backgroundColor: colors.surface }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      >
        <X size={20} color={colors.textPrimary} strokeWidth={2.5} />
      </Pressable>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base), backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
        {/* Quantity */}
        <View style={[styles.qtyRow, { backgroundColor: colors.surfaceContainer }]}>
          <AnimatedPressable style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]} onPress={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
            <Minus size={18} color={quantity <= 1 ? colors.textMuted : colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
          <Text style={[styles.qtyText, { color: colors.textPrimary }]}>{quantity}</Text>
          <AnimatedPressable style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
            <Plus size={18} color={colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>

        {/* Add to cart */}
        <AnimatedPressable
          style={[styles.addBtn, { backgroundColor: colors.primary }, !canAdd && styles.addBtnDisabled]}
          onPress={handleAddToCart}
          disabled={!canAdd}
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>
            {t('addToCart')} — {formatCurrency(lineTotal)}
          </Text>
        </AnimatedPressable>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  // The card now has a definite height (set inline from cardHeight), so
  // flex:1 correctly fills whatever's left under the fixed bottom bar within
  // the 65% card. minHeight: 0 is required — a flex:1 child's default
  // min-height is "auto" (its content size), so without this the wrapper
  // would grow to fit ALL the content instead of being clipped to its fair
  // share; the overflow then just got hidden by the card's overflow:'hidden'
  // with no way to reach it — this is what caused "can't scroll" entirely.
  // position:'relative' makes it the anchor for the fade's bottom:0 below.
  scrollWrapper: { flex: 1, minHeight: 0, position: 'relative' },
  scrollView: { flex: 1 },
  // No horizontal padding here — the hero image must stay edge-to-edge.
  // detailsHeader and groupContainer carry their own paddingHorizontal.
  scrollContent: { paddingBottom: spacing.xl },
  scrollFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  scrollHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  scrollHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollHintText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  // Hero — height set inline (heroHeight); contentFit="contain" on the Image
  // means the full photo is always visible here regardless of aspect ratio.
  hero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroInitial: {
    fontFamily: fonts.heading,
    fontSize: 140,
    fontWeight: '900',
    lineHeight: 140,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  popularText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.3,
  },
  // Details header (fixed — image/name/price never scroll away)
  detailsHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  itemName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.6,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.5,
  },
  basePrice: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
  // Groups
  groupContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  groupName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
    letterSpacing: -0.3,
    flex: 1,
  },
  requiredBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  requiredText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.2,
  },
  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
  },
  optionPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  // Bottom
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    gap: spacing.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    height: 52,
    gap: spacing.xl,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    minWidth: 36,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  addBtn: {
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
});
