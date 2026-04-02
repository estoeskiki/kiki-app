import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Order, OrderStatus } from '../../data/types';
import { StatusBadge } from './StatusBadge';
import { colors } from '../../theme/colors';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onAdvance?: (orderId: string) => void;
}

const NEXT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Accept', color: colors.primary },
  preparing: { label: 'Ready', color: colors.secondary },
  ready: { label: 'Complete', color: colors.success },
};

export function OrderCard({ order, onPress, onAdvance }: OrderCardProps) {
  const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
  const nextAction = NEXT_STATUS_CONFIG[order.status];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>
      <View style={styles.details}>
        <Text style={styles.itemCount}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
        <Text style={styles.orderType}>
          {order.orderType === 'dine-in' ? 'Dine In' : 'Takeaway'}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.time} numberOfLines={1}>
          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {nextAction && onAdvance && (
          <TouchableOpacity
            style={[styles.advanceButton, { backgroundColor: nextAction.color }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onAdvance(order.id);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.advanceText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  itemCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  orderType: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  advanceButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
  },
  advanceText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.background,
  },
});
