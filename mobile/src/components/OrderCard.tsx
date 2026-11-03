import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Order, OrderStatus } from '../types';
import { Colors } from '../constants/colors';
import { Badge } from './ui/Badge';

interface OrderCardProps {
  order: Order;
  isAdmin?: boolean;
  onUpdateStatus?: (status: OrderStatus) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isAdmin = false,
  onUpdateStatus,
}) => {
  const formattedDate = new Date(order.date).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const nextStatusMap: Record<OrderStatus, OrderStatus | null> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'collected',
    collected: null,
    cancelled: null,
  };

  const nextStatusLabels: Record<OrderStatus, string> = {
    pending: 'Mark Preparing 🍳',
    preparing: 'Mark Ready for Pickup 🛍️',
    ready: 'Mark Collected ✅',
    collected: '',
    cancelled: '',
  };

  const next = nextStatusMap[order.status];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{formattedDate}</Text>
          <Text style={styles.mealTime}>
            MEAL {order.mealNumber} • Pickup {order.pickupSlot?.label || '—'}
          </Text>
        </View>
        <Badge type="status" value={order.status} />
      </View>

      <View style={styles.divider} />

      <View style={styles.body}>
        <Text style={styles.foodName}>{order.foodItem?.name || 'Assigned Meal'}</Text>
        {order.foodItem?.dietType && (
          <Badge type="diet" value={order.foodItem.dietType} style={styles.dietBadge} />
        )}
      </View>

      {isAdmin && order.customer && (
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>👤 {order.customer.name}</Text>
          {order.customer.phone ? (
            <Text style={styles.customerDetail}>📞 {order.customer.phone}</Text>
          ) : null}
        </View>
      )}

      {isAdmin && next && onUpdateStatus && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onUpdateStatus(next)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>{nextStatusLabels[order.status]}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  date: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  mealTime: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  dietBadge: {
    marginLeft: 8,
  },
  customerInfo: {
    marginTop: 10,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 8,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  customerDetail: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '600',
  },
});
