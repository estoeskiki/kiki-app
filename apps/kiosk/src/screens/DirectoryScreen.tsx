import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useRestaurantStore } from '@/store/useRestaurantStore';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { CartFAB } from '@/components/cart/CartFAB';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

interface RestaurantCard {
  id: string;
  name: string;
  is_open: boolean;
  logo_url: string | null;
}

// Deterministic pastel background behind a restaurant's logo (or initial when
// there's no logo) — same hashing approach as the menu item plate colors.
const LOGO_PLATES = ['#eef3ff', '#f0fff4', '#fff4f0', '#f9f0ff', '#f0fffe', '#fffbf0', '#fff0f5', '#f0f7ff'] as const;
function getLogoPlate(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PLATES[Math.abs(h) % LOGO_PLATES.length];
}

const NUM_COLUMNS = 2;

export function DirectoryScreen({ navigation }: ScreenProps<'Directory'>) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const foodCourtId = useAuthStore((s) => s.foodCourtId);
  const profile = useRestaurantStore((s) => s.profile);
  const cartItems = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const [restaurants, setRestaurants] = useState<RestaurantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const totalItemCount = useMemo(
    () => cartItems.reduce((sum, ci) => sum + ci.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    if (!foodCourtId) return;

    let isMounted = true;
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, is_open, logo_url')
        .eq('food_court_id', foodCourtId)
        .eq('is_active', true)
        .order('name');

      if (!error && data && isMounted) {
        setRestaurants(data as RestaurantCard[]);
      }
      if (isMounted) setIsLoading(false);
    })();

    // Realtime status updates
    const channel = supabase
      .channel(`food_court_${foodCourtId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `food_court_id=eq.${foodCourtId}`
        },
        (payload) => {
          if (payload.new && 'id' in payload.new) {
            setRestaurants((prev) =>
              prev.map(r => r.id === payload.new.id ? { ...r, is_open: payload.new.is_open } : r)
            );
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [foodCourtId]);

  const renderCard = ({ item, index }: { item: RestaurantCard; index: number }) => {
    const closed = !item.is_open;
    return (
      <Animated.View
        entering={FadeInUp.delay(60 + index * 60).duration(500).springify()}
        style={styles.cardWrapper}
      >
        <AnimatedPressable
          accessibilityLabel={`${item.name}${closed ? `, ${t('closed')}` : ''}`}
          disabled={closed}
          onPress={() => navigation.navigate('Menu', { restaurantId: item.id, restaurantName: item.name })}
          scaleValue={0.97}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
        >
          {/* Square logo plate */}
          <View style={[styles.logoPlate, { backgroundColor: getLogoPlate(item.id) }]}>
            {item.logo_url ? (
              <Image source={item.logo_url} style={styles.logoImage} contentFit="contain" cachePolicy="disk" />
            ) : (
              <Text style={[styles.logoInitial, { color: colors.textSecondary }]}>
                {item.name.trim().charAt(0).toUpperCase()}
              </Text>
            )}

            {closed && (
              <View style={[styles.closedOverlay, { backgroundColor: colors.background + 'B3' }]}>
                <View style={[styles.closedPill, { backgroundColor: colors.textPrimary }]}>
                  <Text style={[styles.closedPillText, { color: colors.background }]}>{t('closed')}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Name + status + go arrow */}
          <View style={styles.cardFooter}>
            <View style={styles.cardFooterLeft}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.statusRow}>
                {!closed && <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />}
                <Text style={[styles.statusText, { color: closed ? colors.textMuted : colors.textSecondary }]}>
                  {closed ? t('closed') : t('open')}
                </Text>
              </View>
            </View>

            {!closed && (
              <View style={[styles.goBtn, { backgroundColor: colors.primary }]}>
                <ArrowRight size={16} color={colors.onPrimary} strokeWidth={2.5} />
              </View>
            )}
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <ScreenWrapper padded={false}>
      <Header
        title={profile?.name ?? ''}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'cart',
          onPress: () => navigation.navigate('Checkout'),
          badge: totalItemCount > 0 ? totalItemCount : undefined,
        }}
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderCard}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Multi-restaurant explainer */}
              <View style={[styles.banner, { backgroundColor: colors.primary + '1A', borderLeftColor: colors.primary }]}>
                <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>{t('directoryBannerTitle')}</Text>
                <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>{t('directoryBannerSub')}</Text>
              </View>

              {/* Section heading */}
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('restaurantsTitle')}</Text>
                <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                  {restaurants.length} {t('availableCount')}
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {t('poweredBy')}
              <Text style={{ color: colors.primary, fontFamily: fonts.heading, letterSpacing: -0.4 }}>kiki</Text>
            </Text>
          }
        />
      )}

      <CartFAB
        itemCount={totalItemCount}
        total={getTotal()}
        onPress={() => navigation.navigate('Checkout')}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  gridRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  // ── Banner ──
  banner: {
    borderLeftWidth: 4,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  bannerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.35,
  },
  bannerSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  // ── Section heading ──
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.5,
  },
  sectionCount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  // ── Cards ──
  cardWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoPlate: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoInitial: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['4xl'],
    fontWeight: '900',
    opacity: 0.3,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  closedPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardFooterLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.base,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  goBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Footer ──
  footerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
