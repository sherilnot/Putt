import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getWeekPlanApi, saveWeeklySelectionApi } from '../../src/services/api';
import { DayName, FoodItem, WeekPlan } from '../../src/types';
import { colors, fonts, radius, shadow } from '../../src/theme';
import { DishArt } from '../../src/components/brand/DishArt';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { dayOfMonth, fmtDate } from '../../src/utils/date';
import { aud } from '../../src/utils/money';

const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Per day: how many of each dish, and when they'll be collected
type DayState = { qty: Record<string, number>; pickupSlot: string | null };

const shortDate = (d: string | Date) => fmtDate(d, { day: 'numeric', month: 'short' });
const mealsOn = (s?: DayState) => Object.values(s?.qty || {}).reduce((a, b) => a + b, 0);

/** − 2 + stepper */
const Stepper: React.FC<{ value: number; canAdd: boolean; disabled: boolean; onChange: (n: number) => void }> = ({
  value,
  canAdd,
  disabled,
  onChange,
}) => (
  <View style={styles.stepper}>
    {value > 0 && (
      <>
        <PressableScale disabled={disabled} onPress={() => onChange(value - 1)} style={styles.stepBtn} hitSlop={6}>
          <Icon name="minus" size={16} color={colors.brand} strokeWidth={2.4} />
        </PressableScale>
        <Animated.View key={value} entering={FadeIn.duration(160)}>
          <Txt variant="subheading" style={styles.stepValue}>
            {value}
          </Txt>
        </Animated.View>
      </>
    )}
    <PressableScale
      disabled={disabled || !canAdd}
      onPress={() => onChange(value + 1)}
      style={[styles.stepBtn, styles.stepAdd, (disabled || !canAdd) && { opacity: 0.35 }]}
      hitSlop={6}
    >
      <Icon name="plus" size={16} color={colors.textOnDark} strokeWidth={2.4} />
    </PressableScale>
  </View>
);

export default function OrderMeals() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [dayIndex, setDayIndex] = useState(0);
  const [dirty, setDirty] = useState(false);

  const max = plan?.maxMealsPerDay ?? 3;
  const editable = Boolean(plan?.isOpen);
  const dayName = DAYS[dayIndex];
  const day = days[dayName];
  const menuDay = plan?.menuDays.find((d) => d.dayName === dayName);

  const dishById = useMemo(() => {
    const m: Record<string, FoodItem> = {};
    plan?.menuDays.forEach((d) => d.dishes.forEach((f) => (m[f._id] = f)));
    return m;
  }, [plan]);

  const load = async () => {
    try {
      const res = await getWeekPlanApi();
      const data: WeekPlan = res.data.data;
      setPlan(data);
      const initial: Record<string, DayState> = {};
      DAYS.forEach((name) => {
        const saved = data.selection?.days?.find((d) => d.dayName === name);
        initial[name] = {
          qty: Object.fromEntries((saved?.items || []).map((i) => [i.foodItem, i.quantity])),
          pickupSlot: saved?.pickupSlot ?? null,
        };
      });
      setDays(initial);
      setDirty(false);
    } catch {
      Alert.alert('Could not load', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever the tab is opened, unless there are unsaved changes
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useFocusEffect(
    useCallback(() => {
      if (!dirtyRef.current) load();
    }, [])
  );

  const mealCount = DAYS.reduce((n, d) => n + mealsOn(days[d]), 0);
  const total = DAYS.reduce(
    (sum, d) => sum + Object.entries(days[d]?.qty || {}).reduce((s, [id, q]) => s + (dishById[id]?.price || 0) * q, 0),
    0
  );

  // Day strip highlight
  const [stripW, setStripW] = useState(0);
  const cell = stripW / 7;
  const hx = useSharedValue(0);
  useEffect(() => {
    hx.value = withSpring(dayIndex * cell, { damping: 18, stiffness: 220 });
  }, [dayIndex, cell]);
  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: hx.value }] }));

  const setQty = (dishId: string, n: number) => {
    const qty = { ...day.qty, [dishId]: n };
    if (n === 0) delete qty[dishId];
    // The first meal of a day picks up at the last pickup time used
    const lastPickup = DAYS.map((d) => days[d].pickupSlot).filter(Boolean).pop() ?? null;
    setDays((prev) => ({
      ...prev,
      [dayName]: { qty, pickupSlot: mealsOn({ qty, pickupSlot: null }) ? day.pickupSlot ?? lastPickup : null },
    }));
    setDirty(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const setPickup = (slotId: string) => {
    setDays((prev) => ({ ...prev, [dayName]: { ...prev[dayName], pickupSlot: slotId } }));
    setDirty(true);
  };

  const applyPickupToAll = () => {
    if (!day.pickupSlot) return;
    setDays((prev) =>
      Object.fromEntries(Object.entries(prev).map(([d, s]) => [d, mealsOn(s) ? { ...s, pickupSlot: day.pickupSlot } : s]))
    );
    setDirty(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const save = async () => {
    if (!plan) return;
    const missing = DAYS.filter((d) => mealsOn(days[d]) > 0 && !days[d].pickupSlot);
    if (missing.length) {
      setDayIndex(DAYS.indexOf(missing[0]));
      Alert.alert('Pickup time needed', `Choose a pickup time for ${missing.join(', ')}.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await saveWeeklySelectionApi({
        weekStartDate: plan.weekStartDate,
        days: DAYS.map((d) => ({
          dayName: d,
          items: Object.entries(days[d].qty).map(([foodItem, quantity]) => ({ foodItem, quantity })),
          pickupSlot: days[d].pickupSlot,
        })),
      });
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Order saved', res.data?.message || 'Your meals for the week are saved.');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Not saved', err.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={30} width="60%" style={{ marginTop: 16 }} />
        <Skeleton height={64} style={{ marginTop: 22 }} />
        <Skeleton height={110} style={{ marginTop: 16 }} />
        <Skeleton height={110} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <EmptyState icon="refresh" title="Couldn't load the menu" text="Check your connection and try again." action={<Button title="Try again" onPress={load} />} />
      </Screen>
    );
  }

  const status = plan.isOpen
    ? { icon: 'clock' as const, label: 'Open', fg: colors.leaf, bg: colors.leafSoft }
    : plan.isLocked
      ? { icon: 'lock' as const, label: 'Closed', fg: colors.chili, bg: colors.chiliSoft }
      : { icon: 'calendar' as const, label: 'Soon', fg: '#8A5A00', bg: colors.goldSoft };

  const header = (
    <ScreenHeader
      overline={`Week of ${shortDate(plan.weekStartDate)} – ${shortDate(plan.weekEndDate)}`}
      title="Your order"
      right={
        <View style={[styles.lock, { backgroundColor: status.bg }]}>
          <Icon name={status.icon} size={14} color={status.fg} />
          <Txt variant="caption" color={status.fg} style={{ fontFamily: fonts.bold }}>
            {status.label}
          </Txt>
        </View>
      }
    />
  );

  if (!plan.hasMenu) {
    return (
      <Screen onRefresh={load}>
        {header}
        <EmptyState
          icon="calendar"
          title="Menu coming soon"
          text={`The kitchen posts this week's dishes by Monday night. Ordering opens ${fmtDate(plan.opensAt, { weekday: 'long', day: 'numeric', month: 'short' })}.`}
        />
      </Screen>
    );
  }

  const dayMeals = mealsOn(day);
  const showBar = editable ? dirty || mealCount > 0 : mealCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={load} contentStyle={{ paddingBottom: showBar ? 120 : 40 }}>
        {header}

        {/* When ordering is possible */}
        <Appear index={1}>
          <Card variant="tint" style={styles.notice}>
            <Icon name={status.icon} size={20} color={status.fg} />
            <Txt variant="body" color={colors.textSoft} style={{ flex: 1 }}>
              {plan.isOpen
                ? `Order 0 to ${max} meals a day. Closes ${plan.selectionDeadlineFormatted}.`
                : plan.isLocked
                  ? 'Orders for this week are closed. The kitchen is preparing.'
                  : `Here's the menu. Ordering opens ${fmtDate(plan.opensAt, { weekday: 'long', day: 'numeric', month: 'short' })} and closes ${plan.selectionDeadlineFormatted}.`}
            </Txt>
          </Card>
        </Appear>

        {/* Day strip */}
        <Appear index={2}>
          <View style={styles.strip} onLayout={(e) => setStripW(e.nativeEvent.layout.width)}>
            {stripW > 0 && <Animated.View style={[styles.stripHighlight, { width: cell - 6 }, highlight]} />}
            {DAYS.map((name, i) => {
              const active = i === dayIndex;
              const filled = mealsOn(days[name]);
              const closed = !plan.menuDays.find((d) => d.dayName === name)?.dishes.length;
              return (
                <Pressable
                  key={name}
                  style={[styles.stripCell, closed && !active && { opacity: 0.45 }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDayIndex(i);
                  }}
                >
                  <Txt variant="caption" color={active ? colors.gold : colors.textMuted} style={{ fontFamily: fonts.bold }}>
                    {name.slice(0, 3).toUpperCase()}
                  </Txt>
                  <Txt variant="subheading" color={active ? colors.textOnDark : colors.text} style={{ fontFamily: fonts.extrabold }}>
                    {dayOfMonth(plan.menuDays[i].date)}
                  </Txt>
                  <View style={styles.dots}>
                    {Array.from({ length: max }).map((_, k) => (
                      <View
                        key={k}
                        style={[
                          styles.dot,
                          { backgroundColor: k < filled ? (active ? colors.gold : colors.brand) : active ? 'rgba(255,255,255,0.25)' : colors.line },
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Appear>

        {/* Selected day */}
        <Animated.View key={dayName} entering={FadeIn.duration(260)} layout={LinearTransition.springify().damping(18)}>
          <View style={styles.dayHead}>
            <Txt variant="heading">{fmtDate(plan.menuDays[dayIndex].date, { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
            {!!menuDay?.dishes.length && (
              <Txt variant="caption" color={colors.textMuted}>
                {dayMeals} of {max}
              </Txt>
            )}
          </View>

          {!menuDay?.dishes.length ? (
            <Card variant="tint" style={styles.notice}>
              <Icon name="store" size={20} color={colors.textMuted} />
              <Txt variant="body" color={colors.textSoft} style={{ flex: 1 }}>
                No meals on this day.
              </Txt>
            </Card>
          ) : (
            menuDay.dishes.map((dish, i) => {
              const q = day.qty[dish._id] || 0;
              return (
                <Animated.View key={dish._id} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
                  <View style={[styles.dishCard, q > 0 && styles.dishCardOn]}>
                    <DishArt name={dish.name} size={60} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="subheading" numberOfLines={2}>
                        {dish.name}
                      </Txt>
                      <View style={styles.dishMeta}>
                        <Badge type="diet" value={dish.dietType} />
                        <Txt variant="label" color={colors.brand} style={{ fontFamily: fonts.bold }}>
                          {aud(dish.price)}
                        </Txt>
                      </View>
                      {!dish.isAvailable && (
                        <Txt variant="caption" color={colors.chili} style={{ marginTop: 2 }}>
                          Sold out
                        </Txt>
                      )}
                    </View>
                    {(editable || q > 0) && (
                      <Stepper
                        value={q}
                        canAdd={dayMeals < max && dish.isAvailable}
                        disabled={!editable}
                        onChange={(n) => setQty(dish._id, n)}
                      />
                    )}
                  </View>
                </Animated.View>
              );
            })
          )}

          {dayMeals > 0 && (
            <>
              <View style={styles.pickupHead}>
                <Txt variant="subheading">Pickup time</Txt>
                {editable && day.pickupSlot && (
                  <PressableScale onPress={applyPickupToAll} style={styles.applyAll}>
                    <Icon name="check" size={14} color={colors.brand} />
                    <Txt variant="caption" color={colors.brand} style={{ fontFamily: fonts.bold }}>
                      Use for every day
                    </Txt>
                  </PressableScale>
                )}
              </View>
              {plan.pickupSlots.map((slot) => {
                const selected = day.pickupSlot === slot._id;
                return (
                  <PressableScale
                    key={slot._id}
                    disabled={!editable}
                    onPress={() => setPickup(slot._id)}
                    style={[styles.slot, selected && styles.slotSelected]}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                    <Icon name="clock" size={18} color={selected ? colors.textOnDark : colors.textSoft} />
                    <Txt variant="bodyStrong" color={selected ? colors.textOnDark : colors.text}>
                      {slot.label}
                    </Txt>
                  </PressableScale>
                );
              })}
            </>
          )}
        </Animated.View>
      </Screen>

      {/* Running bill for the week */}
      {showBar && (
        <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.billBar, shadow.lifted]}>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={colors.textOnDarkSoft}>
              {mealCount} meal{mealCount === 1 ? '' : 's'} this week{dirty ? ' · not saved' : ''}
            </Txt>
            <Txt variant="heading" color={colors.textOnDark}>
              {aud(total)}
            </Txt>
          </View>
          {editable && dirty && <Button title="Save order" icon="check" size="sm" onPress={save} loading={submitting} />}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, marginTop: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  strip: { flexDirection: 'row', marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: colors.lineSoft },
  stripHighlight: { position: 'absolute', top: 3, bottom: 3, left: 6, borderRadius: radius.md, backgroundColor: colors.ink },
  stripCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 5, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 12 },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.4,
    borderColor: colors.lineSoft,
  },
  dishCardOn: { borderColor: colors.brand, backgroundColor: '#FFF8F2', ...shadow.soft },
  dishMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepAdd: { backgroundColor: colors.brand },
  stepValue: { minWidth: 14, textAlign: 'center', fontFamily: fonts.extrabold },
  pickupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 10 },
  applyAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  slotSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.6, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  billBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.ink,
  },
});
