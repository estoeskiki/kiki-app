import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { Order } from '../../data/types';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { useTheme } from '../../theme/useTheme';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

const t = (val: any) => {
  if (!val) return '';
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch {}
  }
  return val?.es || val?.en || val || '';
};

interface OrderDetailsModalProps {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onAccept: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onComplete: (orderId: string) => void;
}

export function OrderDetailsModal({
  order,
  visible,
  onClose,
  onAccept,
  onMarkReady,
  onComplete,
}: OrderDetailsModalProps) {
  const { colors } = useTheme();

  if (!order) return null;

  const renderActionButton = () => {
    switch (order.status) {
      case 'confirmed':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => onAccept(order.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
              Aceptar e Imprimir Ticket
            </Text>
          </TouchableOpacity>
        );
      case 'preparing':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => onMarkReady(order.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
              Marcar como Listo
            </Text>
          </TouchableOpacity>
        );
      case 'ready':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => onComplete(order.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
              Completar Orden
            </Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>
                Orden #{order.orderNumber}{order.customerName ? ` — ${order.customerName}` : ''}
              </Text>
              <View style={styles.headerMeta}>
                <Text style={[styles.orderType, { color: colors.textSecondary }]}>
                  {order.orderType === 'dine-in' ? 'Comer Aquí' : 'Para Llevar'}
                </Text>
                <View style={[styles.dot, { backgroundColor: colors.border }]} />
                <StatusBadge status={order.status} size="sm" />
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceHighlight }]}
              activeOpacity={0.7}
            >
              <X color={colors.textPrimary} size={18} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Items */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ARTÍCULOS</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={[styles.qtyBadge, { backgroundColor: colors.surfaceHighlight }]}>
                  <Text style={[styles.qtyText, { color: colors.primary }]}>{item.quantity}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.textPrimary }]}>{t(item.menuItem.name)}</Text>
                  {Object.values(item.selectedCustomizations).flat().map((opt, idx) => (
                    <Text key={idx} style={[styles.customization, { color: colors.textMuted }]}>
                      + {opt}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  {formatCurrency(item.lineTotal)}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: colors.textPrimary }]}>
                {formatCurrency(order.total)}
              </Text>
            </View>
            {renderActionButton()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.base,
  },
  headerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderNumber: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
  },
  orderType: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.base,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.base,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
    gap: spacing.md,
  },
  qtyBadge: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qtyText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    marginBottom: 2,
  },
  customization: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginBottom: 1,
  },
  itemPrice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    flexShrink: 0,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
  },
  totalAmount: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.3,
  },
  actionBtn: {
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    letterSpacing: -0.2,
  },
});
