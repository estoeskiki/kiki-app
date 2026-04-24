import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/context/ThemeContext';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { UtensilsCrossed } from 'lucide-react-native';
import type { ScreenProps } from '@/navigation/types';

interface RestaurantCard {
  id: string;
  name: string;
  is_open: boolean;
}

const NUM_COLUMNS = 2;

export function DirectoryScreen({ navigation }: ScreenProps<'Directory'>) {
  const { colors } = useTheme();
  const foodCourtId = useAuthStore((s) => s.foodCourtId);
  const [restaurants, setRestaurants] = useState<RestaurantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!foodCourtId) return;

    let isMounted = true;
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, is_open')
        .eq('food_court_id', foodCourtId);

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

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderCard = ({ item, index }: { item: RestaurantCard; index: number }) => {
    const closed = !item.is_open;
    return (
      <Animated.View
        entering={FadeInUp.delay(80 + index * 60).duration(500).springify()}
        style={styles.cardWrapper}
      >
        <AnimatedPressable
          accessibilityLabel={`${item.name}${closed ? ', cerrado' : ''}`}
          disabled={closed}
          onPress={() => navigation.navigate('Menu', { restaurantId: item.id, restaurantName: item.name })}
          scaleValue={0.97}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderLight,
            },
            closed && { opacity: 0.45 },
          ]}
        >
          {/* Logo Placeholder */}
          <View style={[styles.logoCircle, { backgroundColor: colors.surfaceContainer }]}>  
            <UtensilsCrossed size={36} color={colors.textMuted} strokeWidth={1.5} />
          </View>

          {/* Restaurant Name */}
          <Text
            style={[styles.name, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          {/* Status indicator */}
          {closed ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.error + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.statusText, { color: colors.error }]}>Cerrado</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: colors.success + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statusText, { color: colors.success }]}>Abierto</Text>
            </View>
          )}

          {/* Accent bar */}
          <View style={[styles.accentBar, { backgroundColor: closed ? colors.textMuted : colors.primary }]} />
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>FOOD COURT</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          ¿Qué te apetece?
        </Text>
      </View>

      {/* Grid */}
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
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
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  gridRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.xl,
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
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: fontSizes.xl * 1.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.3,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
