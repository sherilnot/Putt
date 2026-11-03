import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getAdminOrdersApi, updateOrderStatusApi } from '../../src/services/api';
import { Order, OrderStatus } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { OrderCard } from '../../src/components/OrderCard';
import { Appear, Segmented, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { messISODate } from '../../src/utils/date';

const STATUS_FILTERS: { label: string; value: '' | OrderStatus }[] = [
  { label: 'All', value: '' },
  { label: 'To prepare', value: 'pending' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Collected', value: 'collected' },
];

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [status, setStatus] = useState<'' | OrderStatus>('');

  const load = async () => {
    try {
      const res = await getAdminOrdersApi({ date: messISODate(day === 'today' ? 0 : 1), status: status || undefined });
      setOrders(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [day, status]);

  const updateStatus = async (id: string, next: OrderStatus) => {
    try {
      const res = await updateOrderStatusApi(id, next);
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status: res.data.data.status } : o)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Error', 'Could not update the order.');
    }
  };

  // Section per pickup window (orders already arrive sorted by window, then customer)
  const sections = useMemo(() => {
    const m = new Map<string, Order[]>();
    orders.forEach((o) => {
      const label = o.pickupSlot?.label || 'No pickup time';
      m.set(label, [...(m.get(label) || []), o]);
    });
    return [...m.entries()];
  }, [orders]);

  return (
    <Screen onRefresh={load}>
      <ScreenHeader overline="Grouped by pickup time" title="Kitchen" />
      <Segmented
        options={[
          { label: 'Today', value: 'today' },
          { label: 'Tomorrow', value: 'tomorrow' },
        ]}
        value={day}
        onChange={setDay}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <PressableScale key={f.label} onPress={() => setStatus(f.value)} style={[styles.chip, active && styles.chipActive]}>
              <Txt variant="label" color={active ? colors.textOnDark : colors.textSoft} style={{ fontFamily: fonts.bold }}>
                {f.label}
              </Txt>
            </PressableScale>
          );
        })}
      </ScrollView>

      {loading ? (
        <>
          <Skeleton height={130} />
          <Skeleton height={130} style={{ marginTop: 12 }} />
        </>
      ) : sections.length === 0 ? (
        <EmptyState icon="chef" title="Nothing here" text={`No ${status ? 'matching ' : ''}meals for ${day}.`} />
      ) : (
        sections.map(([label, list], si) => (
          <Appear key={label + day + status} index={si}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>
                <Icon name="clock" size={16} color={colors.textOnDark} />
              </View>
              <Txt variant="subheading" style={{ flex: 1 }}>
                {label}
              </Txt>
              <Txt variant="label" color={colors.textSoft}>
                {list.length} meal{list.length > 1 ? 's' : ''}
              </Txt>
            </View>
            {list.map((o) => (
              <OrderCard key={o._id} order={o} isAdmin onUpdateStatus={(s) => updateStatus(o._id, s)} />
            ))}
          </Appear>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipScroll: { marginHorizontal: -20, marginTop: 12, marginBottom: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
