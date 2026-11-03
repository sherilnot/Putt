import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { getAdminOrdersApi, updateOrderStatusApi } from '../../src/services/api';
import { Order, OrderStatus } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { OrderCard } from '../../src/components/OrderCard';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Collected', value: 'collected' },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await getAdminOrdersApi({
        status: selectedStatus || undefined,
      });
      if (res.data?.data) {
        setOrders(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load admin orders:', e);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await updateOrderStatusApi(orderId, nextStatus);
      if (res.data?.data) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? res.data.data : o))
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update order status.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Filter Scroll */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.label}
              style={[
                styles.filterPill,
                selectedStatus === f.value && styles.filterPillActive,
              ]}
              onPress={() => setSelectedStatus(f.value)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedStatus === f.value && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            isAdmin={true}
            onUpdateStatus={(nextStatus) => handleUpdateStatus(item._id, nextStatus)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🛵</Text>
            <Text style={styles.emptyText}>No orders found for this filter.</Text>
            <Text style={styles.emptySubtext}>
              When customers select meals or orders are scheduled, they will show here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  filterPillTextActive: {
    color: Colors.text.inverse,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
  },
});
