import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { useAuthStore } from '../../src/store/authStore';
import { getMyOrdersApi, getMySubscriptionApi, getWeekPlanApi } from '../../src/services/api';
import { Order, Subscription, WeekPlan } from '../../src/types';
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

const PaidProgress: React.FC<{ start: string; end: string }> = ({ start, end }) => {
  const total = new Date(end).getTime() - new Date(start).getTime();
  const left = Math.max(0, new Date(end).getTime() - Date.now());
  const fraction = total > 0 ? Math.min(1, left / total) : 0;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(350, withTiming(fraction, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [fraction]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, bar]} />
    </View>
  );
};

export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [week, setWeek] = useState<WeekPlan | null>(null);

  const load = async () => {
    const [subRes, ordersRes, weekRes] = await Promise.all([
      getMySubscriptionApi().catch(() => ({ data: { data: null } })),
      getMyOrdersApi(messISODate()).catch(() => ({ data: { data: [] } })),
      getWeekPlanApi().catch(() => ({ data: { data: null } })),
    ]);
    setSubscription(subRes.data?.data || null);
    setTodayOrders(
      (ordersRes.data?.data || [])
        .filter((o: Order) => o.status !== 'cancelled')
        .sort((a: Order, b: Order) => a.mealNumber - b.mealNumber)
    );
    setWeek(weekRes.data?.data || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const countdown = useCountdown(week?.isLocked ? undefined : week?.selectionDeadline);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const initials = (user?.name || 'PK')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const active = subscription && (subscription.status === 'active' || subscription.status === 'paused');

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

      {/* Plan hero */}
      <Appear index={1}>
        {loading ? (
          <Skeleton height={190} rounded={radius.xl} />
        ) : (
          <HeroBackdrop style={styles.hero}>
            {active ? (
              <>
                <View style={styles.heroTop}>
                  <Txt variant="overline" color={colors.gold}>
                    Your plan
                  </Txt>
                  <Badge type="subscription" value={subscription!.status} />
                </View>
                <Txt variant="heading" color={colors.textOnDark} style={{ marginTop: 8 }}>
                  {subscription!.plan?.name}
                </Txt>
                <Txt variant="caption" color={colors.textOnDarkSoft} style={{ marginTop: 14, marginBottom: 8 }}>
                  Paid until{' '}
                  {fmtDate(subscription!.endDate, { weekday: 'short', day: 'numeric', month: 'short' })}
                </Txt>
                <PaidProgress start={subscription!.startDate} end={subscription!.endDate} />
                <Button
                  title="Choose this week's meals"
                  icon="bowl"
                  onPress={() => router.push('/(customer)/menu')}
                  style={{ marginTop: 18 }}
                />
              </>
            ) : subscription?.status === 'pending' ? (
              <>
                <Txt variant="overline" color={colors.gold}>
                  Almost there
                </Txt>
                <Txt variant="heading" color={colors.textOnDark} style={{ marginTop: 8 }}>
                  Pay the mess to start {subscription.plan?.name}
                </Txt>
                <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginTop: 6 }}>
                  ${subscription.plan?.priceAUD} by cash, bank transfer or PayID. Your plan starts once the manager confirms.
                </Txt>
              </>
            ) : (
              <>
                <Txt variant="overline" color={colors.gold}>
                  Fresh every day
                </Txt>
                <Txt variant="heading" color={colors.textOnDark} style={{ marginTop: 8 }}>
                  Kerala meals, your way
                </Txt>
                <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginTop: 6 }}>
                  1, 2 or 3 meals a day from 15 dishes, ready to pick up at your time.
                </Txt>
                <Button title="See plans" icon="arrowRight" onPress={() => router.push('/(customer)/my-plan')} style={{ marginTop: 18 }} />
              </>
            )}
          </HeroBackdrop>
        )}
      </Appear>

      {/* Cutoff countdown */}
      {countdown && active && (
        <Appear index={2}>
          <PressableScale onPress={() => router.push('/(customer)/menu')} style={styles.countdown}>
            <View style={styles.countdownIcon}>
              <Icon name="clock" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="label">Next week's choices close Thursday night</Txt>
              <Txt variant="caption" color={colors.textSoft}>
                {countdown}
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
                Plan ahead in My Meals before Thursday night.
              </Txt>
            </View>
          </Card>
        )}
      </Appear>

      {/* Dishes carousel */}
      {week && week.dishes.length > 0 && (
        <>
          <SectionTitle title="From our kitchen" action="Choose" onAction={() => router.push('/(customer)/menu')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {week.dishes.map((d, i) => (
              <Appear key={d._id} index={i} delay={250}>
                <View style={styles.dishTile}>
                  <DishArt name={d.name} size={96} />
                  <Txt variant="label" numberOfLines={2} style={{ marginTop: 10, minHeight: 36 }}>
                    {d.name}
                  </Txt>
                  <Badge type="diet" value={d.dietType} style={{ marginTop: 4 }} />
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
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
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
