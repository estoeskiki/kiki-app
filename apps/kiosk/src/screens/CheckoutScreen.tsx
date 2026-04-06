import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { UtensilsCrossed, ShoppingBag } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { OrderReviewList } from '@/components/order/OrderReviewList';
import { CartSummary } from '@/components/cart/CartSummary';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { formatCurrency } from '@/utils/formatCurrency';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

export function CheckoutScreen({ navigation }: ScreenProps<'Checkout'>) {
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTax = useCartStore((s) => s.getTax);
  const getTotal = useCartStore((s) => s.getTotal);
  const orderType = useOrderStore((s) => s.orderType);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const total = getTotal();
  const orderTypeLabel = orderType === 'dine-in' ? t('dineIn') : t('takeaway');

  return (
    <ScreenWrapper padded={false}>
      <Header title={t('reviewOrder')} onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Order type badge */}
          {orderType && (
            <View style={[styles.orderTypePill, { backgroundColor: colors.primary }]}>
              {orderType === 'dine-in'
                ? <UtensilsCrossed size={14} color={colors.onPrimary} strokeWidth={2} />
                : <ShoppingBag size={14} color={colors.onPrimary} strokeWidth={2} />
              }
              <Text style={[styles.orderTypeText, { color: colors.onPrimary }]}>
                {orderTypeLabel}
              </Text>
            </View>
          )}

          <OrderReviewList items={items} />

          <CartSummary
            subtotal={getSubtotal()}
            tax={getTax()}
            total={total}
          />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
          <Button variant="secondary" size="md" fullWidth onPress={() => navigation.goBack()} style={styles.editBtn}>
            {t('editOrder')}
          </Button>
          <Button variant="primary" size="xl" fullWidth onPress={() => navigation.navigate('Payment')}>
            {`${t('placeOrder')} — ${formatCurrency(total)}`}
          </Button>
        </View>
      </View>
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
  orderTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  orderTypeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  editBtn: {
    marginBottom: 2,
  },
});
