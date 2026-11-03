import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  getAllSubscriptionsApi,
  updateSubscriptionStatusApi,
  confirmSubscriptionPaymentApi,
} from '../../src/services/api';
import { Subscription } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Badge } from '../../src/components/ui/Badge';

export default function AdminSubscribers() {
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscribers = async () => {
    try {
      const res = await getAllSubscriptionsApi(filterStatus || undefined);
      if (res.data?.data) {
        setSubscribers(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load subscribers:', e);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [filterStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSubscribers();
    setRefreshing(false);
  };

  const handleToggleStatus = (sub: Subscription) => {
    const nextStatus = sub.status === 'active' ? 'paused' : 'active';
    const actionName = nextStatus === 'paused' ? 'Pause' : 'Activate';

    Alert.alert(
      `${actionName} Subscription`,
      `Are you sure you want to change this subscription to ${nextStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const res = await updateSubscriptionStatusApi(sub._id, nextStatus);
              if (res.data?.data) {
                setSubscribers((prev) =>
                  prev.map((s) => (s._id === sub._id ? res.data.data : s))
                );
              }
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to update subscription status.');
            }
          },
        },
      ]
    );
  };

  const replaceSubscriber = (updated: Subscription) =>
    setSubscribers((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));

  const handleConfirmPayment = (sub: Subscription) => {
    const isRenewal = sub.status !== 'pending';
    const record = async (method: 'cash' | 'bank_transfer' | 'payid') => {
      try {
        const res = await confirmSubscriptionPaymentApi(sub._id, { method });
        if (res.data?.data) {
          replaceSubscriber(res.data.data);
          Alert.alert('Payment recorded ✅', res.data.message);
        }
      } catch (e: any) {
        Alert.alert('Error', e.response?.data?.message || 'Failed to record payment.');
      }
    };

    Alert.alert(
      isRenewal ? 'Record Renewal Payment' : 'Confirm Payment',
      `Received $${sub.plan?.priceAUD || 0} AUD from ${sub.customer?.name || 'this customer'}? How did they pay?`,
      [
        { text: 'Cash', onPress: () => record('cash') },
        { text: 'Bank transfer', onPress: () => record('bank_transfer') },
        { text: 'PayID', onPress: () => record('payid') },
        { text: 'Not yet', style: 'cancel' },
      ]
    );
  };

  const formatDay = (date: string) =>
    new Date(date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  const filters = [
    { label: 'All', value: '' },
    { label: 'Awaiting Payment', value: 'pending' },
    { label: 'Active', value: 'active' },
    { label: 'Paused', value: 'paused' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[
              styles.filterPill,
              filterStatus === f.value && styles.filterPillActive,
            ]}
            onPress={() => setFilterStatus(f.value)}
          >
            <Text
              style={[
                styles.filterPillText,
                filterStatus === f.value && styles.filterPillTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={subscribers}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.subCard}>
            <View style={styles.subHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>
                  {item.customer?.name || 'Customer'}
                </Text>
                <Text style={styles.customerEmail}>
                  {item.customer?.email} • {item.customer?.phone || 'No phone'}
                </Text>
              </View>
              <Badge type="subscription" value={item.status} />
            </View>

            <View style={styles.divider} />

            <View style={styles.planInfo}>
              <Text style={styles.planName}>{item.plan?.name || 'Custom Plan'}</Text>
              <Text style={styles.planPrice}>
                ${item.plan?.priceAUD || 0} AUD / {item.plan?.intervalDays || 7} days
              </Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.dateInfo}>
                {item.status === 'pending'
                  ? `Requested: ${new Date(item.startDate).toLocaleDateString('en-AU')}`
                  : `Paid until: ${formatDay(item.endDate)}`}
              </Text>

              <View style={styles.actionsRow}>
                {item.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={[styles.toggleBtn, styles.payBtn]}
                    onPress={() => handleConfirmPayment(item)}
                  >
                    <Text style={[styles.toggleBtnText, styles.payBtnText]}>
                      {item.status === 'pending' ? 'Confirm Payment' : 'Record Payment'}
                    </Text>
                  </TouchableOpacity>
                )}

                {(item.status === 'active' || item.status === 'paused') && (
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggleStatus(item)}
                  >
                    <Text style={styles.toggleBtnText}>
                      {item.status === 'active' ? 'Pause' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No subscribers found.</Text>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: 'wrap', // five filters don't fit on one line on small phones
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
  subCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  customerEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },
  planInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  planPrice: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  dateInfo: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FAF7F2',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  payBtnText: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: Colors.text.muted,
  },
});
