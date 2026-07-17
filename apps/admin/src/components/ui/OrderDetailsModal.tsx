import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { X, Phone, MapPin } from 'lucide-react-native';
import { Order } from '../../data/types';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { paymentMethodLabel } from '../../utils/orderLabels';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  onCancel: (orderId: string) => void;
  onReprint: (order: Order) => void;
}

export function OrderDetailsModal({
  order,
  visible,
  onClose,
  onAccept,
  onMarkReady,
  onComplete,
  onCancel,
  onReprint,
}: OrderDetailsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!order) return null;

  const isCancellable = order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready';

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
              Marcar Listo
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

          {/* Close button — pinned top-right, always reachable */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.surfaceHighlight }]}
            activeOpacity={0.7}
          >
            <X color={colors.textPrimary} size={18} strokeWidth={2} />
          </TouchableOpacity>

          {/* Scrollable content — header scrolls so footer stays pinned */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>
                  Orden #{order.orderNumber}{order.customerName ? ` — ${order.customerName}` : ''}
                </Text>
                <View style={styles.headerMeta}>
                  <Text style={[styles.orderType, { color: colors.textSecondary }]}>
                    {order.orderType === 'dine-in' ? 'Comer Aquí' : order.orderType === 'delivery' ? 'Delivery' : 'Para Llevar'}
                  </Text>
                  <View style={[styles.dot, { backgroundColor: colors.border }]} />
                  <StatusBadge status={order.status} size="sm" />
                  {order.paymentMethod && (
                    <>
                      <View style={[styles.dot, { backgroundColor: colors.border }]} />
                      <Text style={[styles.orderType, { color: colors.primary }]}>
                        {paymentMethodLabel(order.paymentMethod)}
                      </Text>
                    </>
                  )}
                </View>
                {order.tableLabel && (
                  <View style={[styles.locationChip, { backgroundColor: colors.surfaceHighlight, borderColor: colors.primary }]}>
                    <MapPin color={colors.primary} size={14} strokeWidth={2.5} />
                    <Text style={[styles.locationText, { color: colors.textPrimary }]}>
                      {order.tableLabel}{order.tableNumber ? ` · Mesa ${order.tableNumber}` : ''}
                    </Text>
                  </View>
                )}
                {order.orderType === 'delivery' && order.deliveryAddress && (
                  <Text style={[styles.orderType, { color: colors.textMuted }]}>
                    {order.deliveryAddress.line1}
                    {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}
                  </Text>
                )}
                {order.customerPhone && (
                  <View style={[styles.phoneChip, { backgroundColor: colors.surfaceHighlight }]}>
                    <Phone color={colors.primary} size={13} strokeWidth={2.5} />
                    <Text style={[styles.phoneText, { color: colors.textPrimary }]}>{order.customerPhone}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ARTÍCULOS</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={[styles.qtyBadge, { backgroundColor: colors.surfaceHighlight }]}>
                  <Text style={[styles.qtyText, { color: colors.primary }]}>{item.quantity}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.textPrimary }]}>{t(item.menuItem.name)}</Text>
                  {(item.customizations ?? []).map((opt, idx) => (
                    <View key={idx} style={styles.customizationRow}>
                      <View style={[styles.customizationDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.customization, { color: colors.textSecondary }]}>{opt}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  {formatCurrency(item.lineTotal)}
                </Text>
              </View>
            ))}

            {order.notes && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md }]}>COMENTARIOS</Text>
                <View style={[styles.notesBox, { backgroundColor: colors.surfaceHighlight }]}>
                  <Text style={[styles.notesText, { color: colors.textPrimary }]}>{order.notes}</Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer — pinned to bottom, always on screen */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.borderLight,
                backgroundColor: colors.surface,
                paddingBottom: spacing.xl + insets.bottom,
              },
            ]}
          >
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: colors.textPrimary }]}>
                {formatCurrency(order.total)}
              </Text>
            </View>
            {renderActionButton()}
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.borderLight }]}
                onPress={() => onReprint(order)}
                activeOpacity={0.75}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Reimprimir ticket</Text>
              </TouchableOpacity>
              {isCancellable && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.error }]}
                  onPress={() => onCancel(order.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Cancelar pedido</Text>
                </TouchableOpacity>
              )}
            </View>
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
    paddingBottom: spacing.base,
    paddingRight: 44,
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
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginTop: 2,
  },
  phoneText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.2,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    marginTop: 2,
  },
  locationText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    letterSpacing: 0.2,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xl,
    zIndex: 10,
    elevation: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
  customizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  customizationDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    flexShrink: 0,
  },
  customization: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  itemPrice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    flexShrink: 0,
  },
  notesBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  notesText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    flexShrink: 0,
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
