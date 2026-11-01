import React, { useEffect, useState } from 'react';
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
import {
  getUpcomingMenuApi,
  saveWeeklySelectionApi,
  getCustomerDeliverySlotsApi,
} from '../../src/services/api';
import {
  WeeklyMenu,
  FoodItem,
  DeliverySlot,
  CustomerWeeklySelection,
  DailyMealChoice,
} from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export default function CustomerMenu() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Menu and Week Details
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [weekEndDate, setWeekEndDate] = useState<string>('');
  const [deadlineFormatted, setDeadlineFormatted] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // 7-Day Customer Selections (State map: dayName -> { breakfast, lunch, dinner, deliverySlot })
  const [selectionsMap, setSelectionsMap] = useState<
    Record<string, { breakfast: FoodItem | null; lunch: FoodItem | null; dinner: FoodItem | null }>
  >({});

  // Active Dropdown Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    dayName: string;
    dateStr: string;
    mealTime: 'breakfast' | 'lunch' | 'dinner';
    options: FoodItem[];
  } | null>(null);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const [menuRes, slotsRes] = await Promise.all([
        getUpcomingMenuApi(),
        getCustomerDeliverySlotsApi().catch(() => ({ data: { data: [] } })),
      ]);

      if (slotsRes.data?.data && slotsRes.data.data.length > 0) {
        setDeliverySlots(slotsRes.data.data);
        setSelectedSlotId(slotsRes.data.data[0]._id);
      }

      if (menuRes.data?.data) {
        const d = menuRes.data.data;
        setMenu(d.menu);
        setWeekStartDate(d.weekStartDate);
        setWeekEndDate(d.weekEndDate);
        setDeadlineFormatted(d.selectionDeadlineFormatted);
        setIsLocked(Boolean(d.isLocked));

        // Initialize selections mapping for all 7 days
        const initialMap: Record<string, any> = {};
        DAYS.forEach((dayName) => {
          initialMap[dayName] = { breakfast: null, lunch: null, dinner: null };
        });

        // If customer already submitted selections, populate them
        if (d.customerSelection?.selections) {
          d.customerSelection.selections.forEach((sel: any) => {
            initialMap[sel.dayName] = {
              breakfast: sel.breakfast || null,
              lunch: sel.lunch || null,
              dinner: sel.dinner || null,
            };
          });
        }

        setSelectionsMap(initialMap);
      }
    } catch (e) {
      console.error('Failed to load upcoming week menu:', e);
      Alert.alert('Notice', 'Could not load upcoming menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuData();
  }, []);

  const openOptionDropdown = (
    dayName: string,
    dateStr: string,
    mealTime: 'breakfast' | 'lunch' | 'dinner',
    options: FoodItem[]
  ) => {
    if (isLocked) {
      Alert.alert(
        'Selection Locked',
        `The deadline (${deadlineFormatted}) has passed. Selections for this week cannot be modified.`
      );
      return;
    }

    setPickerTarget({ dayName, dateStr, mealTime, options });
    setPickerModalVisible(true);
  };

  const handleSelectOption = (dish: FoodItem) => {
    if (!pickerTarget) return;

    const { dayName, mealTime } = pickerTarget;
    setSelectionsMap((prev) => ({
      ...prev,
      [dayName]: {
        ...prev[dayName],
        [mealTime]: dish,
      },
    }));

    setPickerModalVisible(false);
  };

  const handleSaveAllSelections = async () => {
    if (isLocked) {
      Alert.alert('Selection Locked', 'The cutoff deadline has passed.');
      return;
    }

    // Build payload array of 7 days
    const selectionsArray = DAYS.map((dayName, idx) => {
      const dayData = menu?.days?.find((d) => d.dayName === dayName);
      const date = dayData?.date || new Date(new Date(weekStartDate).getTime() + idx * 86400000);

      return {
        dayName,
        date,
        breakfast: selectionsMap[dayName]?.breakfast?._id || null,
        lunch: selectionsMap[dayName]?.lunch?._id || null,
        dinner: selectionsMap[dayName]?.dinner?._id || null,
        deliverySlot: selectedSlotId || null,
      };
    });

    setSubmitting(true);
    try {
      const res = await saveWeeklySelectionApi({
        weekStartDate,
        selections: selectionsArray,
        defaultDeliverySlotId: selectedSlotId,
      });

      Alert.alert('Saved! 🎉', res.data?.message || 'Your meals for the week are saved.');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save choices.';
      Alert.alert('Notice', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateHeader = (dayName: string, index: number) => {
    if (!weekStartDate) return dayName;
    const d = new Date(new Date(weekStartDate).getTime() + index * 86400000);
    return d.toLocaleDateString('en-AU', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Week & Thursday Cutoff Header Banner */}
      <View style={[styles.deadlineBanner, isLocked && styles.deadlineBannerLocked]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.weekTitleText}>
              {weekStartDate
                ? `Week: ${new Date(weekStartDate).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })} – ${new Date(weekEndDate).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : 'Upcoming Week'}
            </Text>
            <View
              style={[
                styles.lockBadge,
                isLocked ? styles.badgeLocked : styles.badgeOpen,
              ]}
            >
              <Text style={styles.lockBadgeText}>
                {isLocked ? '🔒 CLOSED' : '⏳ OPEN'}
              </Text>
            </View>
          </View>

          <Text style={styles.deadlineInfoText}>
            {isLocked
              ? `Selection locked on ${deadlineFormatted}. Viewing your saved meals.`
              : `Deadline: Thursday at 11:59 PM (${deadlineFormatted})`}
          </Text>
        </View>
      </View>

      {/* 2. 7-Day Meal Selection Scroll */}
      <ScrollView
        style={styles.scheduleScroll}
        contentContainerStyle={styles.scheduleContent}
      >
        <Text style={styles.introGuide}>
          {isLocked
            ? 'Your final choices for the upcoming week:'
            : 'Select your preferred Breakfast, Lunch, and Dinner for each day below:'}
        </Text>

        {!menu && (
          <Text style={styles.introGuide}>
            🍽️ The kitchen hasn't published next week's menu yet. Check back soon!
          </Text>
        )}

        {(menu ? DAYS : []).map((dayName, dayIndex) => {
          const dayMenuData = menu?.days?.find((d) => d.dayName === dayName);

          const breakfastSlot = dayMenuData?.meals?.find((m) => m.mealTime === 'breakfast');
          const lunchSlot = dayMenuData?.meals?.find((m) => m.mealTime === 'lunch');
          const dinnerSlot = dayMenuData?.meals?.find((m) => m.mealTime === 'dinner');

          const chosenBreakfast = selectionsMap[dayName]?.breakfast;
          const chosenLunch = selectionsMap[dayName]?.lunch;
          const chosenDinner = selectionsMap[dayName]?.dinner;

          return (
            <View key={dayName} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayDateTitle}>
                  📅 {formatDateHeader(dayName, dayIndex)}
                </Text>
              </View>

              <View style={styles.mealRowsContainer}>
                {/* Breakfast Dropdown Row */}
                <View style={styles.mealRow}>
                  <Text style={styles.mealLabel}>Breakfast:</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownBtn,
                      isLocked && styles.dropdownBtnLocked,
                    ]}
                    onPress={() =>
                      openOptionDropdown(
                        dayName,
                        formatDateHeader(dayName, dayIndex),
                        'breakfast',
                        breakfastSlot?.foodItems || []
                      )
                    }
                    disabled={isLocked}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownBtnText,
                        chosenBreakfast && styles.dropdownTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {chosenBreakfast
                        ? `✓ ${chosenBreakfast.name}`
                        : `[Choose Breakfast ▼]`}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Lunch Dropdown Row */}
                <View style={styles.mealRow}>
                  <Text style={styles.mealLabel}>Lunch:</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownBtn,
                      isLocked && styles.dropdownBtnLocked,
                    ]}
                    onPress={() =>
                      openOptionDropdown(
                        dayName,
                        formatDateHeader(dayName, dayIndex),
                        'lunch',
                        lunchSlot?.foodItems || []
                      )
                    }
                    disabled={isLocked}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownBtnText,
                        chosenLunch && styles.dropdownTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {chosenLunch
                        ? `✓ ${chosenLunch.name}`
                        : `[Choose Lunch ▼]`}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Dinner Dropdown Row */}
                <View style={styles.mealRow}>
                  <Text style={styles.mealLabel}>Dinner:</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownBtn,
                      isLocked && styles.dropdownBtnLocked,
                    ]}
                    onPress={() =>
                      openOptionDropdown(
                        dayName,
                        formatDateHeader(dayName, dayIndex),
                        'dinner',
                        dinnerSlot?.foodItems || []
                      )
                    }
                    disabled={isLocked}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownBtnText,
                        chosenDinner && styles.dropdownTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {chosenDinner
                        ? `✓ ${chosenDinner.name}`
                        : `[Choose Dinner ▼]`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* 3. Bottom Save Action Bar */}
        {!menu ? null : !isLocked ? (
          <View style={styles.submitContainer}>
            <Button
              title="Save My Weekly Choices"
              onPress={handleSaveAllSelections}
              loading={submitting}
              style={{ marginBottom: 30 }}
            />
          </View>
        ) : (
          <View style={styles.lockedNoteContainer}>
            <Text style={styles.lockedNoteTitle}>🔒 Weekly Selection Closed</Text>
            <Text style={styles.lockedNoteSub}>
              Cutoff passed on Thursday 11:59 PM. Kitchen preparation is scheduled.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 4. Dropdown Options Modal */}
      <Modal visible={pickerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Select {pickerTarget?.mealTime.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.text.secondary }}>
                  {pickerTarget?.dayName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPickerModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={pickerTarget?.options || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => handleSelectOption(item)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.optionName}>{item.name}</Text>
                      <Badge type="diet" value={item.dietType} />
                    </View>
                    {item.description ? (
                      <Text style={styles.optionDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionPrice}>${item.price.toFixed(2)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ color: Colors.text.muted, fontSize: 13 }}>
                    No options configured by admin for this slot yet.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadlineBanner: {
    backgroundColor: '#FFEFE6',
    borderBottomWidth: 1,
    borderBottomColor: '#F8D5C2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deadlineBannerLocked: {
    backgroundColor: '#F8F9FA',
    borderBottomColor: '#E9ECEF',
  },
  weekTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  lockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOpen: {
    backgroundColor: '#D8F3DC',
  },
  badgeLocked: {
    backgroundColor: '#FFE3E3',
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  deadlineInfoText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 3,
  },
  scheduleScroll: {
    flex: 1,
  },
  scheduleContent: {
    padding: 16,
    paddingBottom: 40,
  },
  introGuide: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 14,
  },
  dayCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 8,
    marginBottom: 12,
  },
  dayDateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  mealRowsContainer: {
    gap: 10,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealLabel: {
    width: 80,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  dropdownBtn: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dropdownBtnLocked: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E5E5E5',
  },
  dropdownBtnText: {
    fontSize: 13,
    color: Colors.text.muted,
  },
  dropdownTextSelected: {
    color: Colors.text.primary,
    fontWeight: '700',
  },
  submitContainer: {
    marginTop: 10,
  },
  lockedNoteContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginTop: 10,
    marginBottom: 30,
  },
  lockedNoteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  lockedNoteSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '65%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  closeBtn: {
    fontSize: 18,
    color: Colors.text.muted,
  },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 8,
  },
});
