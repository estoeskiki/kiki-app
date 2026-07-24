import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { UtensilsCrossed, ShoppingBag, Check } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { useCartStore } from '@/store/useCartStore';
import { formatCurrency } from '@/utils/formatCurrency';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n/useTranslation';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import {
  validateCart,
  fetchZones,
  createOrder,
  CartInvalidError,
  type ZoneSummary,
  type PaymentMethod,
} from '@/services/orderApi';
import type { OrderType } from '@/data/types';
import type { ScreenProps } from '@/navigation/types';

export function CheckoutScreen({ navigation }: ScreenProps<'Checkout'>) {
  const items = useCartStore((s) => s.items);
  const getItemsByRestaurant = useCartStore((s) => s.getItemsByRestaurant);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTax = useCartStore((s) => s.getTax);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [tableId, setTableId] = useState<string | undefined>(undefined);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notesByRestaurant, setNotesByRestaurant] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_on_delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedRestaurantIds, setClosedRestaurantIds] = useState<string[]>([]);
  const [unavailableItemIds, setUnavailableItemIds] = useState<string[]>([]);

  const groups = useMemo(() => getItemsByRestaurant(), [items, getItemsByRestaurant]);
  const closedSet = useMemo(() => new Set(closedRestaurantIds), [closedRestaurantIds]);
  const unavailableSet = useMemo(() => new Set(unavailableItemIds), [unavailableItemIds]);
  const hasBlocked = useMemo(
    () => items.some((it) => closedSet.has(it.restaurantId ?? '') || unavailableSet.has(it.menuItem.id)),
    [items, closedSet, unavailableSet],
  );

  // Fetch the kiosk's orderable (Sala VIP) zones once. Auto-select if there's
  // only one so the customer just types their table number.
  useEffect(() => {
    let cancelled = false;
    fetchZones().then((z) => {
      if (cancelled) return;
      setZones(z);
      if (z.length === 1) setTableId(z[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Soft pre-check — re-validate whenever the cart composition changes. The
  // edge function is authoritative at submit; this surfaces problems early.
  const cartSignature = items.map((it) => `${it.restaurantId}:${it.menuItem.id}`).join('|');
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    validateCart(items.map((it) => ({ restaurantId: it.restaurantId, menuItemId: it.menuItem.id }))).then((v) => {
      if (cancelled) return;
      setClosedRestaurantIds(v.closedRestaurantIds);
      setUnavailableItemIds(v.unavailableItemIds);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  const removeBlocked = () => {
    for (const it of items) {
      if (closedSet.has(it.restaurantId ?? '') || unavailableSet.has(it.menuItem.id)) removeItem(it.id);
    }
    setClosedRestaurantIds([]);
    setUnavailableItemIds([]);
  };

  const phoneDigits = customerPhone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 8;
  const total = getTotal();
  const canSubmit =
    items.length > 0 && customerName.trim().length > 0 && isPhoneValid && !isSubmitting && !hasBlocked;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { orderId, orderNumber } = await createOrder({
        tableId,
        tableNumber: tableId ? tableNumber.trim() || undefined : undefined,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        notes: Object.fromEntries(
          Object.entries(notesByRestaurant)
            .map(([rid, text]) => [rid, text.trim()])
            .filter(([, text]) => text.length > 0),
        ),
        items,
      });
      // Cart cleared on the ThankYou screen's mount, not here, so this page's
      // empty state doesn't flash while the route transition is in flight.
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Welcome' },
          { name: 'ThankYou', params: { orderNumber, orderId, customerName: customerName.trim() } },
        ],
      });
    } catch (err: any) {
      if (err instanceof CartInvalidError) {
        setClosedRestaurantIds(err.closedRestaurantIds);
        setUnavailableItemIds(err.unavailableItemIds);
        setError(null);
      } else {
        setError(err.message ?? t('orderError'));
      }
      setIsSubmitting(false);
    }
  };

  const handleClearCart = () => {
    clearCart();
    navigation.goBack();
  };

  if (items.length === 0) {
    return (
      <ScreenWrapper padded={false}>
        <Header title={t('checkout')} onBack={() => navigation.goBack()} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('emptyCartShort')}</Text>
      </ScreenWrapper>
    );
  }

  const blockedMessage =
    closedRestaurantIds.length > 0 && unavailableItemIds.length > 0
      ? t('cartClosedAndUnavailable')
      : closedRestaurantIds.length > 0
        ? t('cartClosed')
        : t('cartUnavailable');

  return (
    <ScreenWrapper padded={false}>
      <Header title={t('checkout')} onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Blocked banner */}
          {hasBlocked && (
            <View style={[styles.banner, { borderColor: colors.error, backgroundColor: colors.error + '1A' }]}>
              <Text style={[styles.bannerTitle, { color: colors.error }]}>{blockedMessage}</Text>
              <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>{t('cartBlockedHint')}</Text>
              <TouchableOpacity
                onPress={removeBlocked}
                style={[styles.bannerBtn, { backgroundColor: colors.error }]}
                activeOpacity={0.85}
              >
                <Text style={styles.bannerBtnText}>{t('removeAndContinue')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Order summary grouped by restaurant + per-restaurant notes */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('yourOrderTitle')}</Text>
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={[styles.clearCart, { color: colors.error }]}>{t('clearCartAction')}</Text>
            </TouchableOpacity>
          </View>
          {groups.map((g) => {
            const isClosed = closedSet.has(g.restaurantId);
            return (
              <View
                key={g.restaurantId}
                style={[
                  styles.groupCard,
                  { backgroundColor: colors.surface, borderColor: isClosed ? colors.error : colors.borderLight },
                ]}
              >
                {groups.length > 1 && !!g.restaurantName && (
                  <View style={[styles.groupNameRow, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.groupName, { color: colors.textSecondary }]}>{g.restaurantName}</Text>
                    <Text style={[styles.groupCount, { color: colors.textMuted }]}>
                      {g.items.reduce((sum, i) => sum + i.quantity, 0)} {t('itemsCount')}
                    </Text>
                  </View>
                )}
                {isClosed && (
                  <Text style={[styles.closedInline, { color: colors.error }]}>⛔ {t('restaurantClosedInline')}</Text>
                )}
                {g.items.map((item) => (
                  <CartItemRow key={item.id} item={item} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
                ))}
                <View style={styles.notesWrap}>
                  <Text style={[styles.notesLabel, { color: colors.textMuted }]}>
                    {groups.length > 1 ? `${t('notesForPrefix')} ${g.restaurantName}` : t('notesTitle')}
                  </Text>
                  <TextInput
                    value={notesByRestaurant[g.restaurantId] ?? ''}
                    onChangeText={(text) => setNotesByRestaurant((prev) => ({ ...prev, [g.restaurantId]: text }))}
                    placeholder={t('notesPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[
                      styles.notesInput,
                      { color: colors.textPrimary, borderColor: colors.primary + '4D', backgroundColor: colors.primary + '0D' },
                    ]}
                  />
                </View>
              </View>
            );
          })}

          {/* Order type */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('orderTypeTitle')}</Text>
          <View style={styles.toggleRow}>
            {(['dine-in', 'takeaway'] as const).map((type) => {
              const active = orderType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setOrderType(type)}
                  activeOpacity={0.85}
                  style={[
                    styles.toggle,
                    { borderColor: active ? colors.primary : colors.borderLight, backgroundColor: active ? colors.primary + '1A' : 'transparent' },
                  ]}
                >
                  {type === 'dine-in'
                    ? <UtensilsCrossed size={16} color={active ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                    : <ShoppingBag size={16} color={active ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />}
                  <Text style={[styles.toggleText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                    {type === 'dine-in' ? t('dineInShort') : t('takeawayShort')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {orderType === 'takeaway' && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('takeawayNote')}</Text>
          )}

          {/* Sala VIP zone picker */}
          {zones.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('locationTitle')}</Text>
              <Text style={[styles.hint, { color: colors.textMuted, marginBottom: spacing.sm }]}>{t('locationHint')}</Text>
              <View style={styles.zoneWrap}>
                {zones.map((zone) => {
                  const active = tableId === zone.id;
                  return (
                    <TouchableOpacity
                      key={zone.id}
                      onPress={() => setTableId(zone.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.zoneChip,
                        { borderColor: active ? colors.primary : colors.borderLight, backgroundColor: active ? colors.primary + '1A' : 'transparent' },
                      ]}
                    >
                      <Text style={[styles.toggleText, { color: active ? colors.textPrimary : colors.textSecondary }]}>{zone.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {tableId && (
                <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                  <TextInput
                    value={tableNumber}
                    onChangeText={setTableNumber}
                    placeholder={t('tableNumberPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderLight, backgroundColor: colors.surface }]}
                  />
                  <Text style={[styles.hint, { color: colors.textMuted }]}>{t('tableNumberHint')}</Text>
                </View>
              )}
            </>
          )}

          {/* Customer details */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('yourDetails')}</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder={t('namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderLight, backgroundColor: colors.surface, marginTop: spacing.sm }]}
          />
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder={t('phonePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderLight, backgroundColor: colors.surface, marginTop: spacing.sm }]}
          />
          {customerPhone.trim().length > 0 && !isPhoneValid && (
            <Text style={[styles.hint, { color: colors.error, marginTop: 4 }]}>{t('phoneInvalid')}</Text>
          )}

          {/* Payment method (display only — pay on delivery) */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('paymentTitle')}</Text>
          <Text style={[styles.hint, { color: colors.textMuted, marginBottom: spacing.sm }]}>{t('paymentHint')}</Text>
          {(['yappy', 'card_on_delivery'] as const).map((method) => {
            const active = paymentMethod === method;
            return (
              <TouchableOpacity
                key={method}
                onPress={() => setPaymentMethod(method)}
                activeOpacity={0.85}
                style={[
                  styles.payRow,
                  { borderColor: active ? colors.primary : colors.borderLight, backgroundColor: active ? colors.primary + '1A' : colors.surface },
                ]}
              >
                <Text style={[styles.payText, { color: colors.textPrimary }]}>
                  {method === 'yappy' ? t('payYappy') : t('payCard')}
                </Text>
                {active && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}

          <CartSummary subtotal={getSubtotal()} tax={getTax()} total={total} />

          {!!error && <Text style={[styles.hint, { color: colors.error }]}>{error}</Text>}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
          <Button variant="primary" size="xl" fullWidth disabled={!canSubmit} loading={isSubmitting} onPress={handleSubmit}>
            {isSubmitting ? t('sendingOrder') : `${t('confirmOrder')} — ${formatCurrency(total)}`}
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
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center',
    padding: spacing['3xl'],
  },
  banner: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  bannerTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  bannerSub: { fontFamily: fonts.body, fontSize: fontSizes.xs },
  bannerBtn: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  bannerBtnText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.sm, color: '#ffffff' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  clearCart: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  groupCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  closedInline: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xs, marginBottom: spacing.sm },
  notesWrap: { marginTop: spacing.md, gap: spacing.xs },
  notesLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  toggleText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs },
  zoneWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  zoneChip: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    marginBottom: spacing.sm,
  },
  payText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
