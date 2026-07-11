import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Order } from '../../data/types';
import { StatusBadge } from './StatusBadge';
import { paymentMethodLabel } from '../../utils/orderLabels';
import { useTheme } from '../../theme/useTheme';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onAdvance?: (orderId: string) => void;
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  'dine-in': 'Aquí',
  takeaway: 'Llevar',
  delivery: 'Delivery',
};

export function OrderCard({ order, onPress, onAdvance }: OrderCardProps) {
  const { colors, isDark } = useTheme();
  const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

  const accentColorMap: Record<string, string> = {
    confirmed: colors.statusConfirmedText,
    preparing: colors.statusPreparingText,
    ready: colors.statusReadyText,
    completed: colors.textMuted,
    cancelled: colors.error,
    failed: colors.error,
  };

  const advanceConfigMap: Record<string, { label: string; bg: string; text: string }> = {
    confirmed: { label: 'Aceptar',   bg: colors.primary,    text: colors.onPrimary },
    preparing: { label: 'Listo',     bg: colors.secondary,  text: '#ffffff' },
    ready:     { label: 'Completar', bg: colors.success,    text: '#ffffff' },
  };

  const accentColor = accentColorMap[order.status] ?? colors.textMuted;
  const advanceConfig = advanceConfigMap[order.status];

  const shadowStyle = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
    : { shadowColor: '#060e1d', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        shadowStyle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Status accent left bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.inner}>
        {/* Top row */}
        <View style={styles.topRow}>
          <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>
            #{order.orderNumber}{order.customerName ? ` — ${order.customerName}` : ''}
          </Text>
          <StatusBadge status={order.status} size="sm" />
        </View>

        {/* Middle row */}
        <View style={styles.midRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
          </Text>
          <View style={[styles.typePill, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[styles.typeText, { color: colors.textSecondary }]}>
              {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
            </Text>
          </View>
          {order.paymentMethod && (
            <View style={[styles.typePill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.typeText, { color: colors.onPrimary }]}>
                {paymentMethodLabel(order.paymentMethod)}
              </Text>
            </View>
          )}
          {order.tableLabel && (
            <View style={[styles.typePill, { backgroundColor: colors.surfaceHighlight }]}>
              <Text style={[styles.typeText, { color: colors.textSecondary }]}>
                {order.tableLabel}{order.tableNumber ? ` · Mesa ${order.tableNumber}` : ''}
              </Text>
            </View>
          )}
        </View>

        {order.orderType === 'delivery' && order.deliveryAddress?.line1 && (
          <Text style={[styles.detail, { color: colors.textMuted }]}>{order.deliveryAddress.line1}</Text>
        )}

        {order.customerPhone && (
          <Text style={[styles.phone, { color: colors.textPrimary }]}>📞 {order.customerPhone}</Text>
        )}

        {order.notes && (
          <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={2}>
            💬 {order.notes}
          </Text>
        )}

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {advanceConfig && onAdvance && (
            <TouchableOpacity
              style={[styles.advanceBtn, { backgroundColor: advanceConfig.bg }]}
              onPress={(e) => {
                e.stopPropagation?.();
                onAdvance(order.id);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.advanceText, { color: advanceConfig.text }]}>
                {advanceConfig.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  inner: {
    flex: 1,
    padding: spacing.base,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.5,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  notes: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
  },
  phone: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  typePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  advanceBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  advanceText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
});
