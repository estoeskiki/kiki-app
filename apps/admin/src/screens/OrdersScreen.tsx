import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text, Alert } from 'react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { OrderCard } from '../components/ui/OrderCard';
import { OrderDetailsModal } from '../components/ui/OrderDetailsModal';
import { useOrdersStore } from '../store/useOrdersStore';
import { printTicket } from '../services/printerService';
import { Order } from '../data/types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

export default function OrdersScreen() {
  const { orders, fetchOrders, subscribeToOrders, unsubscribeFromOrders, acceptOrder, markOrderReady, markOrderCompleted } = useOrdersStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  React.useEffect(() => {
    fetchOrders();
    subscribeToOrders();
    return () => {
      unsubscribeFromOrders();
    };
  }, [fetchOrders, subscribeToOrders, unsubscribeFromOrders]);

  const activeOrders = orders.filter(o => !['completed', 'failed'].includes(o.status));

  // Mock order simulation removed since we are now connected to Supabase

  const handleAccept = async (orderId: string) => {
    acceptOrder(orderId);
    if (selectedOrder && selectedOrder.id === orderId) {
      printTicket(selectedOrder).then(() => {
         Alert.alert('Impreso', `Ticket para Orden #${selectedOrder.orderNumber} impreso con éxito.`);
      });
      setSelectedOrder({ ...selectedOrder, status: 'preparing' });
    }
  };

  const handleMarkReady = (orderId: string) => {
    markOrderReady(orderId);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: 'ready' });
    }
  };

  const handleComplete = (orderId: string) => {
    markOrderCompleted(orderId);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(null);
    }
  };

  const handleAdvance = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    switch (order.status) {
      case 'confirmed':
        acceptOrder(orderId);
        printTicket(order).then(() => {
          Alert.alert('Impreso', `Ticket para Orden #${order.orderNumber} impreso.`);
        });
        break;
      case 'preparing':
        markOrderReady(orderId);
        break;
      case 'ready':
        markOrderCompleted(orderId);
        break;
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Órdenes Activas</Text>
      </View>
      
      <FlatList
        data={activeOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => setSelectedOrder(item)} onAdvance={handleAdvance} />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay órdenes activas en este momento.</Text>
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
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
  },
  simulateBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  simulateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  listContainer: {
    padding: spacing.base,
  },
  empty: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
});
