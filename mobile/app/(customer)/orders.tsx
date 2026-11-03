import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getMyOrdersApi } from '../../src/services/api';
import { Order } from '../../src/types';
import { colors, radius } from '../../src/theme';
import { OrderCard } from '../../src/components/OrderCard';
import { Appear, Segmented, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { Txt } from '../../src/components/ui/Txt';
import { dayOfMonth, fmtDate, messDayKey, messISODate } from '../../src/utils/date';


export default function CustomerPickups() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = async () => {
    try {
      const res = await getMyOrdersApi();
      setOrders(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Group by day; upcoming = today onwards (soonest first), past = before today (latest first)
  const groups = useMemo(() => {
    const today = messISODate();
    const list = orders.filter((o) =>
      tab === 'upcoming' ? messDayKey(o.date) >= today : messDayKey(o.date) < today
    );
    const map = new Map<string, Order[]>();
    list.forEach((o) => map.set(messDayKey(o.date), [...(map.get(messDayKey(o.date)) || []), o]));
    const entries = [...map.entries()].map(([k, v]) => ({
      key: k,
      date: new Date(v[0].date),
      orders: v.sort((a, b) => a.mealNumber - b.mealNumber),
    }));
    return entries.sort((a, b) => (tab === 'upcoming' ? +a.date - +b.date : +b.date - +a.date));
  }, [orders, tab]);

  return (
    <Screen onRefresh={load}>
      <ScreenHeader overline="Collect at the mess" title="Pickups" />
      <Segmented
        options={[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 18 }}
      />

      {loading ? (
        <>
          <Skeleton height={110} />
          <Skeleton height={110} style={{ marginTop: 12 }} />
        </>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="bag"
          title={tab === 'upcoming' ? 'No pickups yet' : 'No past pickups'}
          text={tab === 'upcoming' ? 'Once your plan is active and you choose your meals, they appear here.' : 'Meals you have collected will show up here.'}
          action={tab === 'upcoming' ? <Button title="Choose meals" icon="bowl" onPress={() => router.push('/(customer)/menu')} /> : undefined}
        />
      ) : (
        groups.map((g, gi) => (
          <Appear key={g.key + tab} index={gi}>
            <View style={styles.dayHead}>
              <View style={styles.dateBadge}>
                <Txt variant="caption" color={colors.gold}>
                  {fmtDate(g.date, { weekday: 'short' }).toUpperCase()}
                </Txt>
                <Txt variant="subheading" color={colors.textOnDark}>
                  {dayOfMonth(g.date)}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="subheading">{fmtDate(g.date, { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
                {g.orders[0].pickupSlot && (
                  <View style={styles.pickupRow}>
                    <Icon name="clock" size={14} color={colors.textSoft} />
                    <Txt variant="caption" color={colors.textSoft}>
                      Pickup {g.orders[0].pickupSlot.label}
                    </Txt>
                  </View>
                )}
              </View>
            </View>
            {g.orders.map((o) => (
              <OrderCard key={o._id} order={o} />
            ))}
          </Appear>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: 6 },
  dateBadge: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
});
