import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '../../src/store/authStore';
import { getAdminOrdersApi, getDashboardStatsApi } from '../../src/services/api';
import { DashboardStats, Order } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { DishArt } from '../../src/components/brand/DishArt';
import { Appear, CountUp, Skeleton } from '../../src/components/ui/Motion';
import { IconButton, Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { fmtDate } from '../../src/utils/date';

const Bar: React.FC<{ fraction: number; delay: number }> = ({ fraction, delay }) => {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(delay, withTiming(fraction, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [fraction]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, style]} />
    </View>
  );
};

const Stat: React.FC<{ icon: IconName; label: string; value?: number; tone: string; bg: string; onPress?: () => void }> = ({
  icon,
  label,
  value,
  tone,
  bg,
  onPress,
}) => (
  <PressableScale onPress={onPress} disabled={!onPress} style={styles.stat}>
    <View style={[styles.statIcon, { backgroundColor: bg }]}>
      <Icon name={icon} size={19} color={tone} />
    </View>
    <CountUp value={value} style={styles.statValue} />
    <Txt variant="caption" color={colors.textSoft}>
      {label}
    </Txt>
  </PressableScale>
);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function AdminToday() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [statsRes, ordersRes] = await Promise.all([
      getDashboardStatsApi().catch(() => ({ data: { stats: null } })),
      getAdminOrdersApi().catch(() => ({ data: { data: [] } })),
    ]);
    setStats(statsRes.data?.stats || null);
    setOrders((ordersRes.data?.data || []).filter((o: Order) => o.status !== 'cancelled'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Cook list: how many of each dish today, plus meals per pickup window
  const cookList = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o) => o.foodItem && m.set(o.foodItem.name, (m.get(o.foodItem.name) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const windows = useMemo(() => {
    const m = new Map<string, { label: string; start: string; count: number; done: number }>();
    orders.forEach((o) => {
      const key = o.pickupSlot?._id || 'none';
      const w = m.get(key) || { label: o.pickupSlot?.label || 'No time', start: o.pickupSlot?.startTime || '99', count: 0, done: 0 };
      w.count += 1;
      if (o.status === 'ready' || o.status === 'collected') w.done += 1;
      m.set(key, w);
    });
    return [...m.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [orders]);
  const remaining = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;

  const signOut = () =>
    Alert.alert('Sign out?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);

  return (
    <Screen onRefresh={load}>
      <ScreenHeader
        overline={fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}
        title={greeting()}
        right={<IconButton icon="logout" onPress={signOut} />}
      />

      <Appear index={1}>
        {loading ? (
          <Skeleton height={170} rounded={radius.xl} />
        ) : (
          <HeroBackdrop style={styles.hero}>
            <Txt variant="overline" color={colors.gold}>
              Today's kitchen
            </Txt>
            <View style={styles.heroRow}>
              <CountUp value={orders.length} style={styles.heroNumber} />
              <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginBottom: 10 }}>
                meals to serve
              </Txt>
            </View>
            <PressableScale onPress={() => router.push('/(admin)/orders')} style={styles.heroAction}>
              <Icon name="chef" size={17} color={colors.ink} />
              <Txt variant="label" color={colors.ink} style={{ fontFamily: fonts.bold, flex: 1 }}>
                {remaining > 0 ? `${remaining} still to prepare` : 'All meals ready'}
              </Txt>
              <Icon name="arrowRight" size={17} color={colors.ink} />
            </PressableScale>
          </HeroBackdrop>
        )}
      </Appear>

      {!!stats?.awaitingPayment && (
        <Appear index={2}>
          <PressableScale onPress={() => router.push('/(admin)/subscribers')} style={styles.alert}>
            <View style={styles.alertIcon}>
              <Icon name="cash" size={20} color="#8A5A00" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">
                {stats.awaitingPayment} plan request{stats.awaitingPayment > 1 ? 's' : ''} to confirm
              </Txt>
              <Txt variant="caption" color={colors.textSoft}>
                Confirm once the customer has paid
              </Txt>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </PressableScale>
        </Appear>
      )}

      <Appear index={3} style={styles.stats}>
        <Stat icon="users" label="Active" value={stats?.activeSubscribers} tone={colors.leaf} bg={colors.leafSoft} onPress={() => router.push('/(admin)/subscribers')} />
        <Stat icon="cash" label="To confirm" value={stats?.awaitingPayment ?? 0} tone="#8A5A00" bg={colors.goldSoft} onPress={() => router.push('/(admin)/subscribers')} />
        <Stat icon="cloche" label="Dishes" value={stats?.totalFoodItems} tone={colors.brand} bg={colors.brandSoft} onPress={() => router.push('/(admin)/food-items')} />
      </Appear>

      {windows.length > 0 && (
        <>
          <SectionTitle title="Pickup windows" />
          <Appear index={4}>
            <Card>
              {windows.map((w, i) => (
                <View key={w.label} style={{ marginTop: i ? 14 : 0 }}>
                  <View style={styles.windowHead}>
                    <Txt variant="label">{w.label}</Txt>
                    <Txt variant="caption" color={colors.textSoft}>
                      {w.done}/{w.count} ready
                    </Txt>
                  </View>
                  <Bar fraction={w.count ? w.done / w.count : 0} delay={300 + i * 120} />
                </View>
              ))}
            </Card>
          </Appear>
        </>
      )}

      <SectionTitle title="Cook list" action="Kitchen" onAction={() => router.push('/(admin)/orders')} />
      {cookList.length === 0 ? (
        <Card variant="tint" style={styles.emptyCook}>
          <Icon name="cloche" size={24} color={colors.textMuted} />
          <Txt variant="body" color={colors.textSoft} style={{ flex: 1 }}>
            No meals ordered for today yet.
          </Txt>
        </Card>
      ) : (
        cookList.map(([name, count], i) => (
          <Appear key={name} index={i} delay={200}>
            <View style={styles.cookRow}>
              <DishArt name={name} size={46} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                {name}
              </Txt>
              <View style={styles.countPill}>
                <Txt variant="label" color={colors.textOnDark} style={{ fontFamily: fonts.extrabold }}>
                  × {count}
                </Txt>
              </View>
            </View>
          </Appear>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 22 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 },
  heroNumber: { fontFamily: fonts.displayBold, fontSize: 64, lineHeight: 70, color: colors.textOnDark, letterSpacing: -2 },
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
  },
  alertIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF6DF', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.lineSoft },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text },
  windowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.leaf },
  emptyCook: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  countPill: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
});
