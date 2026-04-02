import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Order } from '../../data/types';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { colors } from '../../theme/colors';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

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
  if (!order) return null;

  const renderActionButtons = () => {
    switch (order.status) {
      case 'confirmed':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => onAccept(order.id)}
          >
            <Text style={styles.buttonText}>Aceptar e Imprimir Ticket</Text>
          </TouchableOpacity>
        );
      case 'preparing':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.secondary }]}
            onPress={() => onMarkReady(order.id)}
          >
            <Text style={styles.buttonText}>Marcar como Listo</Text>
          </TouchableOpacity>
        );
      case 'ready':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success }]}
            onPress={() => onComplete(order.id)}
          >
            <Text style={styles.buttonText}>Completar Orden</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.orderNumber}>Orden #{order.orderNumber}</Text>
              <Text style={styles.orderType}>
                {order.orderType === 'dine-in' ? 'Comer Aquí' : 'Para Llevar'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Estado:</Text>
            <StatusBadge status={order.status} />
          </View>

          <ScrollView style={styles.itemsList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemQuantity}>
                  <Text style={styles.quantityText}>{item.quantity}x</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.menuItem.name}</Text>
                  {Object.values(item.selectedCustomizations).flat().map((opt, idx) => (
                    <Text key={idx} style={styles.customizationText}>
                      + {opt}
                    </Text>
                  ))}
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(item.lineTotal)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{formatCurrency(order.total)}</Text>
            </View>
            {renderActionButtons()}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  orderNumber: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
  },
  orderType: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 8,
  },
  closeButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statusLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  itemsList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: spacing.base,
    alignItems: 'flex-start',
  },
  itemQuantity: {
    width: 32,
    height: 32,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  quantityText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customizationText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  itemPrice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.base,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  totalLabel: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  totalAmount: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.primary,
  },
  button: {
    padding: spacing.base,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.background,
  },
});
