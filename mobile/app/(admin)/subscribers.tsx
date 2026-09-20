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
            } catch (e) {
              Alert.alert('Error', 'Failed to update subscription status.');
            }
          },
        },
      ]
    );
  };

  const filters = [
    { label: 'All', value: '' },
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

            {item.customer?.address?.street ? (
              <Text style={styles.addressText}>
                📍 {item.customer.address.street}, {item.customer.address.suburb}{' '}
                {item.customer.address.postcode}
              </Text>
            ) : null}

            <View style={styles.footerRow}>
              <Text style={styles.dateInfo}>
                Started: {new Date(item.startDate).toLocaleDateString('en-AU')}
              </Text>

              {item.status !== 'cancelled' && (
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
  addressText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 8,
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
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: Colors.text.muted,
  },
});
