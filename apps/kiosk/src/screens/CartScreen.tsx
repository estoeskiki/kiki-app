import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { useCartStore } from '@/store/useCartStore';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

export function CartScreen({ navigation }: ScreenProps<'Cart'>) {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTax = useCartStore((s) => s.getTax);
  const getTotal = useCartStore((s) => s.getTotal);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isEmpty = items.length === 0;

  return (
    <ScreenWrapper padded={false}>
      <Header
        title={t('yourOrder')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'cart', onPress: () => {}, badge: totalItemCount }}
      />

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainer }]}>
            <ShoppingCart size={36} color={colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('emptyCartTitle')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {t('emptyCartSub')}
          </Text>
          <Button variant="ghost" size="lg" onPress={() => navigation.goBack()}>
            {t('browseMenu')}
          </Button>
        </View>
      ) : (
        <View style={styles.content}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
            <CartSummary
              subtotal={getSubtotal()}
              tax={getTax()}
              total={getTotal()}
            />
            <Button variant="primary" size="xl" fullWidth onPress={() => navigation.navigate('Checkout')}>
              {t('continueToCheckout')}
            </Button>
          </View>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
