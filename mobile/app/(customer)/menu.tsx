import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { getWeekPlanApi, saveWeeklySelectionApi } from '../../src/services/api';
import { DayName, FoodItem, WeekPlan } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type DayState = { meals: (string | null)[]; pickupSlot: string | null };

const formatShort = (date: string | Date) =>
  new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

export default function CustomerMenu() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [picker, setPicker] = useState<{ dayName: DayName; index: number } | null>(null);

  const mealsPerDay = plan?.mealsPerDay ?? 0;
  const isLocked = Boolean(plan?.isLocked);
  const dishById = useMemo(
    () => Object.fromEntries((plan?.dishes || []).map((d) => [d._id, d])),
    [plan]
  );

  const loadWeek = async () => {
    try {
      setLoading(true);
      const res = await getWeekPlanApi();
      const data: WeekPlan = res.data.data;
      setPlan(data);

      // One row per day with as many meal slots as the plan allows, prefilled from saved choices
      const n = data.mealsPerDay ?? 0;
      const initial: Record<string, DayState> = {};
      DAYS.forEach((dayName) => {
        const saved = data.selection?.days?.find((d) => d.dayName === dayName);
        initial[dayName] = {
          meals: Array.from({ length: n }, (_, i) => saved?.meals?.[i] ?? null),
          pickupSlot: saved?.pickupSlot ?? null,
        };
      });
      setDays(initial);
    } catch (e) {
      Alert.alert('Notice', 'Could not load this week. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeek();
  }, []);

  const setMeal = (dayName: DayName, index: number, dishId: string | null) => {
    setDays((prev) => {
      const meals = [...prev[dayName].meals];
      meals[index] = dishId;
      return { ...prev, [dayName]: { ...prev[dayName], meals } };
    });
    setPicker(null);
  };

  const setPickup = (dayName: DayName, slotId: string) =>
    setDays((prev) => ({ ...prev, [dayName]: { ...prev[dayName], pickupSlot: slotId } }));

  const setPickupForAllDays = (slotId: string) =>
    setDays((prev) =>
      Object.fromEntries(Object.entries(prev).map(([d, s]) => [d, { ...s, pickupSlot: slotId }]))
    );

  const handleSave = async () => {
    if (!plan) return;
    const missingPickup = DAYS.filter(
      (d) => days[d].meals.some(Boolean) && !days[d].pickupSlot
    );
    if (missingPickup.length > 0) {
      Alert.alert('Choose a pickup time', `Please pick a pickup time for ${missingPickup.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveWeeklySelectionApi({
        weekStartDate: plan.weekStartDate,
        days: DAYS.map((dayName) => ({
          dayName,
          meals: days[dayName].meals.filter((m): m is string => Boolean(m)),
          pickupSlot: days[dayName].pickupSlot,
        })),
      });
      Alert.alert('Saved! 🎉', res.data?.message || 'Your meals for the week are saved.');
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.message || 'Failed to save your meals.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.center}>
        <Button title="Try again" onPress={loadWeek} />
      </View>
    );
  }

  const weekStart = new Date(plan.weekStartDate);

  return (
    <View style={styles.container}>
      {/* Week & Thursday cutoff */}
      <View style={[styles.banner, isLocked && styles.bannerLocked]}>
        <View style={styles.bannerRow}>
          <Text style={styles.bannerTitle}>
            Week: {formatShort(plan.weekStartDate)} – {formatShort(plan.weekEndDate)}
          </Text>
          <View style={[styles.lockBadge, isLocked ? styles.badgeLocked : styles.badgeOpen]}>
            <Text style={styles.lockBadgeText}>{isLocked ? '🔒 CLOSED' : '⏳ OPEN'}</Text>
          </View>
        </View>
        <Text style={styles.bannerSub}>
          {isLocked
            ? `Choices closed on ${plan.selectionDeadlineFormatted}.`
            : `Choose by ${plan.selectionDeadlineFormatted}`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mealsPerDay === 0 ? (
          <>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Get a plan to start choosing</Text>
              <Text style={styles.noticeText}>
                Open the My Plan tab to request a plan. Once the manager confirms your payment, you
                can choose your meals here.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Our dishes ({plan.dishes.length})</Text>
            {plan.dishes.map((dish) => (
              <View key={dish._id} style={styles.dishRow}>
                <Text style={styles.dishName}>{dish.name}</Text>
                <Badge type="diet" value={dish.dietType} />
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.intro}>
              Your plan: {mealsPerDay} meal{mealsPerDay > 1 ? 's' : ''} a day, collected together at
              the mess at the time you choose.
            </Text>

            {!isLocked && plan.pickupSlots.length > 0 && (
              <View style={styles.allDaysCard}>
                <Text style={styles.allDaysLabel}>Same pickup time every day:</Text>
                <View style={styles.chipRow}>
                  {plan.pickupSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot._id}
                      style={styles.chip}
                      onPress={() => setPickupForAllDays(slot._id)}
                    >
                      <Text style={styles.chipText}>{slot.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {DAYS.map((dayName, dayIndex) => {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + dayIndex);
              const day = days[dayName];

              return (
                <View key={dayName} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>
                    📅 {date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>

                  {day.meals.map((dishId, i) => (
                    <View key={i} style={styles.mealRow}>
                      <Text style={styles.mealLabel}>Meal {i + 1}</Text>
                      <TouchableOpacity
                        style={[styles.dropdown, isLocked && styles.dropdownLocked]}
                        disabled={isLocked}
                        onPress={() => setPicker({ dayName, index: i })}
                      >
                        <Text
                          style={[styles.dropdownText, dishId && styles.dropdownTextChosen]}
                          numberOfLines={1}
                        >
                          {dishId ? `✓ ${dishById[dishId]?.name || 'Dish'}` : 'Choose a dish ▼'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <Text style={styles.pickupLabel}>Pickup time</Text>
                  <View style={styles.chipRow}>
                    {plan.pickupSlots.map((slot) => {
                      const selected = day.pickupSlot === slot._id;
                      return (
                        <TouchableOpacity
                          key={slot._id}
                          style={[styles.chip, selected && styles.chipSelected]}
                          disabled={isLocked}
                          onPress={() => setPickup(dayName, slot._id)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {slot.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {isLocked ? (
              <Text style={styles.lockedNote}>
                🔒 This week is closed. The kitchen is preparing your meals.
              </Text>
            ) : (
              <Button
                title="Save My Meals"
                onPress={handleSave}
                loading={submitting}
                style={{ marginTop: 8, marginBottom: 30 }}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Dish picker */}
      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {picker ? `${picker.dayName} · Meal ${picker.index + 1}` : ''}
            </Text>
            <FlatList
              data={plan.dishes}
              keyExtractor={(d: FoodItem) => d._id}
              ListHeaderComponent={
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => picker && setMeal(picker.dayName, picker.index, null)}
                >
                  <Text style={styles.optionClear}>No meal</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => picker && setMeal(picker.dayName, picker.index, item._id)}
                >
                  <Text style={styles.optionText}>{item.name}</Text>
                  <Badge type="diet" value={item.dietType} />
                </TouchableOpacity>
              )}
            />
            <Button title="Close" variant="outline" onPress={() => setPicker(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: 16 },
  banner: {
    backgroundColor: '#FFF3E6',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bannerLocked: { backgroundColor: '#F1F1F1' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary },
  bannerSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 4 },
  lockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOpen: { backgroundColor: '#D8F3DC' },
  badgeLocked: { backgroundColor: '#FFE3E3' },
  lockBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.text.primary },
  intro: { fontSize: 13, color: Colors.text.secondary, marginBottom: 12 },
  noticeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  noticeTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, marginBottom: 6 },
  noticeText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, marginBottom: 10 },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  dishName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, flex: 1, marginRight: 8 },
  allDaysCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  allDaysLabel: { fontSize: 13, fontWeight: '700', color: Colors.text.primary, marginBottom: 8 },
  dayCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  dayTitle: { fontSize: 15, fontWeight: '800', color: Colors.text.primary, marginBottom: 10 },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mealLabel: { width: 62, fontSize: 13, fontWeight: '700', color: Colors.text.secondary },
  dropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAF7F2',
  },
  dropdownLocked: { opacity: 0.6 },
  dropdownText: { fontSize: 14, color: Colors.text.muted },
  dropdownTextChosen: { color: Colors.text.primary, fontWeight: '600' },
  pickupLabel: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary, marginTop: 6, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FAF7F2',
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
  chipTextSelected: { color: Colors.text.inverse },
  lockedNote: { textAlign: 'center', color: Colors.text.secondary, marginVertical: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text.primary, marginBottom: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionText: { fontSize: 15, color: Colors.text.primary, flex: 1, marginRight: 8 },
  optionClear: { fontSize: 15, color: Colors.text.muted },
});
