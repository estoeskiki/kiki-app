import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { OrderReviewList } from '@/components/order/OrderReviewList';
import { CartSummary } from '@/components/cart/CartSummary';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { formatCurrency } from '@/utils/formatCurrency';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import type { ScreenProps } from '@/navigation/types';

export function CheckoutScreen({ navigation }: ScreenProps<'Checkout'>) {
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTax = useCartStore((s) => s.getTax);
  const getTotal = useCartStore((s) => s.getTotal);
  const orderType = useOrderStore((s) => s.orderType);

  const total = getTotal();
  const orderTypeLabel = orderType === 'dine-in' ? 'Dine In' : 'Takeaway';
  const orderTypeIcon: keyof typeof Ionicons.glyphMap =
    orderType === 'dine-in' ? 'restaurant-outline' : 'bag-handle-outline';

  return (
    <ScreenWrapper padded={false}>
      <Header title="Review Order" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Order type badge */}
          {orderType && (
            <View style={styles.orderTypeBadge}>
              <Ionicons name={orderTypeIcon} size={18} color={colors.primary} />
              <Text style={styles.orderTypeText}>{orderTypeLabel}</Text>
            </View>
          )}

          {/* Items review */}
          <OrderReviewList items={items} />

          {/* Summary */}
          <CartSummary
            subtotal={getSubtotal()}
            tax={getTax()}
            total={total}
          />
        </ScrollView>

        {/* Pinned footer */}
        <View style={styles.footer}>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => navigation.goBack()}
            style={styles.editButton}
          >
            Edit Order
          </Button>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={() => navigation.navigate('Payment')}
          >
            {`Place Order \u2014 ${formatCurrency(total)}`}
          </Button>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  orderTypeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  editButton: {
    marginBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.base,
  },
});
