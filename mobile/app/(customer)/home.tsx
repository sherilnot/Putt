import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getMyBillsApi, getMyOrdersApi, getWeekPlanApi } from '../../src/services/api';
import { Bill, FoodItem, Order, WeekPlan } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { DishArt } from '../../src/components/brand/DishArt';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { Screen, SectionTitle } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { fmtDate, messISODate } from '../../src/utils/date';
import { aud } from '../../src/utils/money';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Live "2d 4h left" until the Thursday cutoff. */
const useCountdown = (deadline?: string) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [week, setWeek] = useState<WeekPlan | null>(null);

  const load = async () => {
    const [billsRes, ordersRes, weekRes] = await Promise.all([
      getMyBillsApi().catch(() => ({ data: { data: [] } })),
      getMyOrdersApi(messISODate()).catch(() => ({ data: { data: [] } })),
      getWeekPlanApi().catch(() => ({ data: { data: null } })),
    ]);
    setBills(billsRes.data?.data || []);
    setTodayOrders(
      (ordersRes.data?.data || [])
        .filter((o: Order) => o.status !== 'cancelled')
        .sort((a: Order, b: Order) => a.mealNumber - b.mealNumber)
    );
    setWeek(weekRes.data?.data || null);
    setLoading(false);
  };

  // Reload whenever the tab is opened, so changes made elsewhere show up
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const countdown = useCountdown(week?.isOpen ? week.selectionDeadline : undefined);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const initials = (user?.name || 'PK')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const owing = bills.filter((b) => b.payment?.status !== 'paid').reduce((n, b) => n + b.totalAUD, 0);
  const weekTotal = week?.selection?.totalAUD || 0;
  // Every dish on the coming week's menu, once
  const weekDishes = useMemo(() => {
    const m = new Map<string, FoodItem>();
    week?.menuDays.forEach((d) => d.dishes.forEach((f) => m.set(f._id, f)));
    return [...m.values()];
  }, [week]);
  const weekRange = week
    ? `${fmtDate(week.weekStartDate, { day: 'numeric', month: 'short' })} – ${fmtDate(week.weekEndDate, { day: 'numeric', month: 'short' })}`
    : '';

  return (
    <Screen onRefresh={load}>
      {/* Greeting */}
      <Appear style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={colors.textMuted}>
            {greeting()},
          </Txt>
          <Txt variant="title">{firstName}</Txt>
        </View>
        <PressableScale onPress={() => router.push('/(customer)/profile')} style={styles.avatar}>
          <Txt variant="label" color={colors.textOnDark} style={{ fontFamily: fonts.bold }}>
            {initials}
          </Txt>
        </PressableScale>
      </Appear>

      {/* This week's ordering */}
      <Appear index={1}>
        {loading ? (
          <Skeleton height={190} rounded={radius.xl} />
        ) : (
          <HeroBackdrop style={styles.hero}>
            <View style={styles.heroTop}>
              <Txt variant="overline" color={colors.gold}>
                {week?.isOpen ? 'Ordering is open' : week?.isLocked ? 'Orders closed' : 'Coming up'}
              </Txt>
              {countdown && (
                <View style={styles.countPill}>
                  <Icon name="clock" size={13} color={colors.ink} />
                  <Txt variant="caption" color={colors.ink} style={{ fontFamily: fonts.bold }}>
                    {countdown}
                  </Txt>
                </View>
              )}
            </View>
            <Txt variant="heading" color={colors.textOnDark} style={{ marginTop: 8 }}>
              Week of {weekRange}
            </Txt>
            <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginTop: 6 }}>
              {!week
                ? '3 Kerala dishes a day. Order 1, 2 or 3 meals, or none.'
                : week.isOpen
                  ? weekTotal > 0
                    ? `Your bill so far is ${aud(weekTotal)}. You can change it until ${week.selectionDeadlineFormatted}.`
                    : `Pick 0 to 3 meals a day by ${week.selectionDeadlineFormatted}.`
                  : week.isLocked
                    ? 'The kitchen is preparing this week.'
                    : `Ordering opens ${fmtDate(week.opensAt, { weekday: 'long', day: 'numeric', month: 'short' })}.`}
            </Txt>
            <Button
              title={week?.isOpen ? (weekTotal > 0 ? 'Change my order' : 'Order meals') : 'See the menu'}
              icon={week?.isOpen ? 'bowl' : 'calendar'}
              onPress={() => router.push('/(customer)/menu')}
              style={{ marginTop: 18 }}
            />
          </HeroBackdrop>
        )}
      </Appear>

      {/* Money owed */}
      {owing > 0 && (
        <Appear index={2}>
          <PressableScale onPress={() => router.push('/(customer)/bills')} style={styles.countdown}>
            <View style={[styles.countdownIcon, { backgroundColor: colors.goldSoft }]}>
              <Icon name="receipt" size={18} color="#8A5A00" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="label">{aud(owing)} to pay</Txt>
              <Txt variant="caption" color={colors.textSoft}>
                Cash, bank transfer or PayID at the mess
              </Txt>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </PressableScale>
        </Appear>
      )}

      {/* Today */}
      <SectionTitle title="Today's pickup" />
      <Appear index={3}>
        {loading ? (
          <Skeleton height={120} />
        ) : todayOrders.length > 0 ? (
          <Card>
            <View style={styles.pickupHead}>
              <View style={styles.pickupTime}>
                <Icon name="clock" size={16} color={colors.textOnDark} />
                <Txt variant="label" color={colors.textOnDark}>
                  {todayOrders[0].pickupSlot?.label || 'Pickup'}
                </Txt>
              </View>
              <Badge type="status" value={todayOrders[0].status} />
            </View>
            {todayOrders.map((o) => (
              <View key={o._id} style={styles.mealRow}>
                <DishArt name={o.foodItem?.name || ''} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color={colors.textMuted}>
                    Meal {o.mealNumber}
                  </Txt>
                  <Txt variant="bodyStrong">{o.foodItem?.name}</Txt>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card variant="tint" style={styles.emptyToday}>
            <Icon name="cloche" size={26} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Nothing to collect today</Txt>
              <Txt variant="caption" color={colors.textSoft}>
                Order next week's meals from Wednesday.
              </Txt>
            </View>
          </Card>
        )}
      </Appear>

      {/* Dishes carousel */}
      {weekDishes.length > 0 && (
        <>
          <SectionTitle title="On the menu" action="Order" onAction={() => router.push('/(customer)/menu')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {weekDishes.map((d, i) => (
              <Appear key={d._id} index={i} delay={250}>
                <View style={styles.dishTile}>
                  <DishArt name={d.name} size={96} />
                  <Txt variant="label" numberOfLines={2} style={{ marginTop: 10, minHeight: 36 }}>
                    {d.name}
                  </Txt>
                  <View style={styles.tileMeta}>
                    <Badge type="diet" value={d.dietType} />
                    <Txt variant="caption" color={colors.brand} style={{ fontFamily: fonts.bold }}>
                      {aud(d.price)}
                    </Txt>
                  </View>
                </View>
              </Appear>
            ))}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 18 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: radius.xl, padding: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gold, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  tileMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  countdownIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pickupTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  emptyToday: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dishTile: {
    width: 128,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
});
