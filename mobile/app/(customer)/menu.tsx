import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getWeekPlanApi, saveWeeklySelectionApi } from '../../src/services/api';
import { DayName, DietType, FoodItem, WeekPlan } from '../../src/types';
import { colors, fonts, radius, shadow } from '../../src/theme';
import { DishArt } from '../../src/components/brand/DishArt';
import { Appear, Segmented, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { addDays, dayOfMonth, fmtDate } from '../../src/utils/date';

const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type DayState = { meals: (string | null)[]; pickupSlot: string | null };

const shortDate = (d: string | Date) => fmtDate(d, { day: 'numeric', month: 'short' });

export default function MyMeals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [dayIndex, setDayIndex] = useState(0);
  const [picker, setPicker] = useState<number | null>(null); // meal slot being chosen
  const [dietFilter, setDietFilter] = useState<'all' | DietType>('all');
  const [dirty, setDirty] = useState(false);

  const mealsPerDay = plan?.mealsPerDay ?? 0;
  const isLocked = Boolean(plan?.isLocked);
  const dayName = DAYS[dayIndex];
  const day = days[dayName];
  const dishById = useMemo(() => Object.fromEntries((plan?.dishes || []).map((d) => [d._id, d])), [plan]);

  const load = async () => {
    try {
      const res = await getWeekPlanApi();
      const data: WeekPlan = res.data.data;
      setPlan(data);
      const n = data.mealsPerDay ?? 0;
      const initial: Record<string, DayState> = {};
      DAYS.forEach((name) => {
        const saved = data.selection?.days?.find((d) => d.dayName === name);
        initial[name] = {
          meals: Array.from({ length: n }, (_, i) => saved?.meals?.[i] ?? null),
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

  useEffect(() => {
    load();
  }, []);

  const chosenCount = DAYS.reduce((n, d) => n + (days[d]?.meals.filter(Boolean).length || 0), 0);
  const totalSlots = mealsPerDay * 7;

  // Week progress bar
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(totalSlots ? chosenCount / totalSlots : 0, { duration: 500 });
  }, [chosenCount, totalSlots]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  // Day strip highlight
  const [stripW, setStripW] = useState(0);
  const cell = stripW / 7;
  const hx = useSharedValue(0);
  useEffect(() => {
    hx.value = withSpring(dayIndex * cell, { damping: 18, stiffness: 220 });
  }, [dayIndex, cell]);
  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: hx.value }] }));

  const update = (name: DayName, next: Partial<DayState>) => {
    setDays((prev) => ({ ...prev, [name]: { ...prev[name], ...next } }));
    setDirty(true);
  };

  const chooseDish = (dishId: string | null) => {
    if (picker === null) return;
    const meals = [...day.meals];
    meals[picker] = dishId;
    // Picking the first meal of a day defaults its pickup time to the last one used
    const lastPickup = DAYS.map((d) => days[d].pickupSlot).filter(Boolean).pop() ?? null;
    update(dayName, { meals, pickupSlot: day.pickupSlot ?? (dishId ? lastPickup : null) });
    Haptics.selectionAsync().catch(() => {});
    setPicker(null);
  };

  const applyPickupToAll = () => {
    if (!day.pickupSlot) return;
    setDays((prev) => Object.fromEntries(Object.entries(prev).map(([d, s]) => [d, { ...s, pickupSlot: day.pickupSlot }])));
    setDirty(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const save = async () => {
    if (!plan) return;
    const missing = DAYS.filter((d) => days[d].meals.some(Boolean) && !days[d].pickupSlot);
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
          meals: days[d].meals.filter((m): m is string => Boolean(m)),
          pickupSlot: days[d].pickupSlot,
        })),
      });
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved', res.data?.message || 'Your meals for the week are saved.');
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
        <Skeleton height={150} style={{ marginTop: 16 }} />
        <Skeleton height={150} style={{ marginTop: 12 }} />
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

  const dateOf = (i: number) => addDays(plan.weekStartDate, i);

  // Browsing without an active plan: show the dish gallery
  if (mealsPerDay === 0) {
    return (
      <Screen onRefresh={load}>
        <ScreenHeader overline="Our kitchen" title="15 Kerala dishes" subtitle="Get a plan to start choosing your meals each week." />
        <Button title="See plans" icon="wallet" onPress={() => router.push('/(customer)/my-plan')} style={{ marginBottom: 20 }} />
        <View style={styles.grid}>
          {plan.dishes.map((d, i) => (
            <Appear key={d._id} index={i} style={styles.gridItem}>
              <View style={styles.galleryCard}>
                <DishArt name={d.name} size={120} />
                <Txt variant="label" numberOfLines={2} style={{ marginTop: 10, minHeight: 36 }}>
                  {d.name}
                </Txt>
                <Badge type="diet" value={d.dietType} style={{ marginTop: 4 }} />
              </View>
            </Appear>
          ))}
        </View>
      </Screen>
    );
  }

  const filteredDishes = plan.dishes.filter((d) => dietFilter === 'all' || d.dietType === dietFilter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={load} contentStyle={{ paddingBottom: dirty && !isLocked ? 110 : 40 }}>
        <ScreenHeader
          overline={`Week of ${shortDate(plan.weekStartDate)} – ${shortDate(plan.weekEndDate)}`}
          title="Your meals"
          right={
            <View style={[styles.lock, isLocked ? styles.lockClosed : styles.lockOpen]}>
              <Icon name={isLocked ? 'lock' : 'clock'} size={14} color={isLocked ? colors.chili : colors.leaf} />
              <Txt variant="caption" color={isLocked ? colors.chili : colors.leaf} style={{ fontFamily: fonts.bold }}>
                {isLocked ? 'Closed' : 'Open'}
              </Txt>
            </View>
          }
        />

        {/* Week progress */}
        <Appear index={1} style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Txt variant="label">
              {chosenCount} of {totalSlots} meals chosen
            </Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {isLocked ? 'Kitchen is preparing' : `Closes ${plan.selectionDeadlineFormatted}`}
            </Txt>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </Appear>

        {/* Day strip */}
        <Appear index={2}>
          <View style={styles.strip} onLayout={(e) => setStripW(e.nativeEvent.layout.width)}>
            {stripW > 0 && <Animated.View style={[styles.stripHighlight, { width: cell - 6 }, highlight]} />}
            {DAYS.map((name, i) => {
              const active = i === dayIndex;
              const filled = days[name]?.meals.filter(Boolean).length || 0;
              return (
                <Pressable
                  key={name}
                  style={styles.stripCell}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDayIndex(i);
                  }}
                >
                  <Txt variant="caption" color={active ? colors.gold : colors.textMuted} style={{ fontFamily: fonts.bold }}>
                    {name.slice(0, 3).toUpperCase()}
                  </Txt>
                  <Txt variant="subheading" color={active ? colors.textOnDark : colors.text} style={{ fontFamily: fonts.extrabold }}>
                    {dayOfMonth(dateOf(i))}
                  </Txt>
                  <View style={styles.dots}>
                    {Array.from({ length: mealsPerDay }).map((_, k) => (
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
          <Txt variant="heading" style={{ marginTop: 22, marginBottom: 12 }}>
            {fmtDate(dateOf(dayIndex), { weekday: 'long', day: 'numeric', month: 'long' })}
          </Txt>

          {day.meals.map((dishId, i) => {
            const dish = dishId ? dishById[dishId] : null;
            return (
              <Animated.View key={i} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
                <PressableScale disabled={isLocked} onPress={() => setPicker(i)} style={[styles.mealCard, dish && styles.mealCardFilled]}>
                  {dish ? (
                    <DishArt name={dish.name} size={58} />
                  ) : (
                    <View style={styles.mealPlaceholder}>
                      <Icon name="plus" size={22} color={colors.brand} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Txt variant="overline" color={colors.textMuted}>
                      Meal {i + 1}
                    </Txt>
                    <Txt variant="subheading" color={dish ? colors.text : colors.textSoft} numberOfLines={2}>
                      {dish ? dish.name : 'Choose a dish'}
                    </Txt>
                    {dish && <Badge type="diet" value={dish.dietType} style={{ marginTop: 4 }} />}
                  </View>
                  {!isLocked && <Icon name={dish ? 'refresh' : 'chevronRight'} size={18} color={colors.textMuted} />}
                </PressableScale>
              </Animated.View>
            );
          })}

          <View style={styles.pickupHead}>
            <Txt variant="subheading">Pickup time</Txt>
            {!isLocked && day.pickupSlot && (
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
                disabled={isLocked}
                onPress={() => update(dayName, { pickupSlot: slot._id })}
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
        </Animated.View>
      </Screen>

      {/* Sticky save bar appears once there are unsaved changes */}
      {dirty && !isLocked && (
        <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.saveBar, shadow.lifted]}>
          <Txt variant="label" color={colors.textOnDark} style={{ flex: 1 }}>
            Unsaved changes
          </Txt>
          <Button title="Save week" icon="check" size="sm" onPress={save} loading={submitting} />
        </Animated.View>
      )}

      {/* Dish picker sheet */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View>
              <Txt variant="overline" color={colors.brand}>
                {dayName} · Meal {(picker ?? 0) + 1}
              </Txt>
              <Txt variant="heading">Pick a dish</Txt>
            </View>
            <PressableScale onPress={() => chooseDish(null)} style={styles.clearBtn}>
              <Txt variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.bold }}>
                No meal
              </Txt>
            </PressableScale>
          </View>
          <Segmented
            options={[
              { label: 'All', value: 'all' },
              { label: 'Non-veg', value: 'non-veg' },
              { label: 'Veg', value: 'veg' },
            ]}
            value={dietFilter}
            onChange={(v) => setDietFilter(v as 'all' | DietType)}
            style={{ marginBottom: 12 }}
          />
          <FlatList
            data={filteredDishes}
            keyExtractor={(d: FoodItem) => d._id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const selected = picker !== null && day.meals[picker] === item._id;
              return (
                <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(320)} style={{ flex: 1 }}>
                  <PressableScale onPress={() => chooseDish(item._id)} style={[styles.dishOption, selected && styles.dishOptionSelected]}>
                    <DishArt name={item.name} size={64} />
                    <Txt variant="label" numberOfLines={2} style={{ marginTop: 8, minHeight: 36 }}>
                      {item.name}
                    </Txt>
                    <Badge type="diet" value={item.dietType} style={{ marginTop: 2 }} />
                    {selected && (
                      <View style={styles.selectedTick}>
                        <Icon name="check" size={14} color={colors.textOnDark} strokeWidth={2.4} />
                      </View>
                    )}
                  </PressableScale>
                </Animated.View>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, marginTop: 6 },
  lockOpen: { backgroundColor: colors.leafSoft },
  lockClosed: { backgroundColor: colors.chiliSoft },
  progressCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.lineSoft },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  strip: { flexDirection: 'row', marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: colors.lineSoft },
  stripHighlight: { position: 'absolute', top: 3, bottom: 3, left: 6, borderRadius: radius.md, backgroundColor: colors.ink },
  stripCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 5, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    marginBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  mealCardFilled: { borderStyle: 'solid', borderColor: colors.lineSoft, ...shadow.soft },
  mealPlaceholder: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
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
  saveBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  dishOption: {
    flex: 1,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.4,
    borderColor: colors.lineSoft,
  },
  dishOptionSelected: { borderColor: colors.brand, backgroundColor: '#FFF8F2' },
  selectedTick: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47.5%' },
  galleryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.lineSoft },
});
