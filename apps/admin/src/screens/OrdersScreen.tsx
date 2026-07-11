import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Text, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { OrderCard } from '../components/ui/OrderCard';
import { OrderDetailsModal } from '../components/ui/OrderDetailsModal';
import { useOrdersStore } from '../store/useOrdersStore';
import { useAuthStore } from '../store/useAuthStore';
import { printTicket } from '../services/printerService';
import { Order } from '../data/types';
import { useTheme } from '../theme/useTheme';
import { spacing, borderRadius } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

export default function OrdersScreen() {
  const { orders, isLoading, fetchOrders, subscribeToOrders, unsubscribeFromOrders, acceptOrder, markOrderReady, markOrderCompleted, cancelOrder } = useOrdersStore();
  const restaurantId = useAuthStore((s) => s.restaurantId);
  const restaurantName = useAuthStore((s) => s.restaurantName);
  const foodCourtName = useAuthStore((s) => s.foodCourtName);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { colors } = useTheme();

  // Re-fetch when restaurantId becomes available (async after login)
  React.useEffect(() => {
    if (!restaurantId) return;
    fetchOrders();
    subscribeToOrders();
    return () => { unsubscribeFromOrders(); };
  }, [restaurantId, fetchOrders, subscribeToOrders, unsubscribeFromOrders]);

  const activeOrders = orders.filter(o => !['completed', 'cancelled', 'failed'].includes(o.status));

  const handleAccept = async (orderId: string) => {
    acceptOrder(orderId);
    if (selectedOrder?.id === orderId) {
      printTicket(selectedOrder, restaurantName ?? undefined, foodCourtName).then(() => {
        Alert.alert('Impreso', `Ticket para Orden #${selectedOrder.orderNumber} impreso.`);
      });
      setSelectedOrder({ ...selectedOrder, status: 'preparing' });
    }
  };

  const handleMarkReady = (orderId: string) => {
    markOrderReady(orderId);
    if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, status: 'ready' });
  };

  const handleComplete = (orderId: string) => {
    markOrderCompleted(orderId);
    if (selectedOrder?.id === orderId) setSelectedOrder(null);
  };

  const handleCancel = (orderId: string) => {
    Alert.alert(
      'Cancelar pedido',
      '¿Seguro que quieres cancelar este pedido? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            cancelOrder(orderId);
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
          },
        },
      ],
    );
  };

  const handleReprint = (order: Order) => {
    printTicket(order, restaurantName ?? undefined, foodCourtName).then(() => {
      Alert.alert('Impreso', `Ticket para Orden #${order.orderNumber} impreso.`);
    });
  };

  const handleAdvance = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    switch (order.status) {
      case 'confirmed':
        acceptOrder(orderId);
        printTicket(order, restaurantName ?? undefined, foodCourtName).then(() => Alert.alert('Impreso', `Ticket para Orden #${order.orderNumber} impreso.`));
        break;
      case 'preparing': markOrderReady(orderId); break;
      case 'ready': markOrderCompleted(orderId); break;
    }
  };

  return (
    <ScreenWrapper>
      {/* Page header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.borderLight }]}>
        <View>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Órdenes</Text>
          {activeOrders.length > 0 && (
            <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
              {activeOrders.length} activa{activeOrders.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {activeOrders.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.statusConfirmedBg }]}>
              <Text style={[styles.countText, { color: colors.statusConfirmedText }]}>
                {activeOrders.length}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => fetchOrders()}
            disabled={isLoading}
            style={[styles.refreshBtn, { backgroundColor: colors.surfaceContainer }]}
            activeOpacity={0.7}
          >
            <RefreshCw color={colors.textPrimary} size={16} strokeWidth={2} />
            <Text style={[styles.refreshBtnText, { color: colors.textPrimary }]}>Refrescar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activeOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => setSelectedOrder(item)} onAdvance={handleAdvance} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => fetchOrders()} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={styles.emptyEmoji}>🍽</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin órdenes activas</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Las nuevas órdenes aparecerán aquí en tiempo real.
            </Text>
          </View>
        }
      />

      <OrderDetailsModal
        order={selectedOrder}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onAccept={handleAccept}
        onMarkReady={handleMarkReady}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onReprint={handleReprint}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  refreshBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  list: {
    padding: spacing.base,
    paddingTop: spacing.md,
  },
  empty: {
    paddingVertical: spacing['5xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: fontSizes.sm * 1.6,
  },
});
