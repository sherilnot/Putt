import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getUpcomingWeeksApi,
  getWeeklyMenuByWeekApi,
  saveWeeklyMenuDraftApi,
  publishWeeklyMenuApi,
  getFoodItemsApi,
} from '../../src/services/api';
import {
  WeeklyMenu,
  FoodItem,
  MealTime,
  UpcomingWeekOption,
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

export default function AdminMenuManager() {
  const [weeks, setWeeks] = useState<UpcomingWeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<UpcomingWeekOption | null>(null);
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [allItems, setAllItems] = useState<FoodItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Review full 7-day schedule modal
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  // Dish picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMealTime, setPickerMealTime] = useState<MealTime>('lunch');

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [weeksRes, itemsRes] = await Promise.all([
        getUpcomingWeeksApi(),
        getFoodItemsApi(),
      ]);

      if (itemsRes.data?.data) {
        setAllItems(itemsRes.data.data);
      }

      if (weeksRes.data?.data && weeksRes.data.data.length > 0) {
        setWeeks(weeksRes.data.data);
        // Default to Next Week (weekIndex = 1) if available, else first
        const nextWeek = weeksRes.data.data.find((w: any) => w.weekIndex === 1) || weeksRes.data.data[0];
        setSelectedWeek(nextWeek);
        await loadWeekMenu(nextWeek.weekStartDate);
      }
    } catch (e) {
      console.error('Failed to load menu planner data:', e);
      Alert.alert('Error', 'Failed to load weeks.');
    } finally {
      setLoading(false);
    }
  };

  const loadWeekMenu = async (weekStartDate: string) => {
    try {
      const res = await getWeeklyMenuByWeekApi(weekStartDate);
      if (res.data?.data) {
        setMenu(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load menu for week:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSelectWeek = async (week: UpcomingWeekOption) => {
    setSelectedWeek(week);
    setLoading(true);
    await loadWeekMenu(week.weekStartDate);
    setLoading(false);
  };

  const currentDayData = menu?.days?.find((d) => d.dayName === selectedDay);

  const openPicker = (mealTime: MealTime) => {
    setPickerMealTime(mealTime);
    setPickerVisible(true);
  };

  const handleAddDish = (dish: FoodItem) => {
    if (!menu) return;

    const newDays = menu.days.map((day) => {
      if (day.dayName !== selectedDay) return day;

      const newMeals = day.meals.map((m) => {
        if (m.mealTime !== pickerMealTime) return m;

        // Check if already assigned to this slot
        const exists = m.foodItems.some((fi) => fi._id === dish._id);
        if (exists) return m;

        return {
          ...m,
          foodItems: [...m.foodItems, dish],
        };
      });

      return { ...day, meals: newMeals };
    });

    setMenu({ ...menu, days: newDays });
    setPickerVisible(false);
  };

  const handleRemoveDish = (mealTime: MealTime, dishId: string) => {
    if (!menu) return;

    const newDays = menu.days.map((day) => {
      if (day.dayName !== selectedDay) return day;

      const newMeals = day.meals.map((m) => {
        if (m.mealTime !== mealTime) return m;
        return {
          ...m,
          foodItems: m.foodItems.filter((fi) => fi._id !== dishId),
        };
      });

      return { ...day, meals: newMeals };
    });

    setMenu({ ...menu, days: newDays });
  };

  const handleSaveDraft = async () => {
    if (!menu || !selectedWeek) return;
    setSavingDraft(true);
    try {
      const payload = {
        title: menu.title,
        weekStartDate: selectedWeek.weekStartDate,
        days: menu.days.map((d) => ({
          dayName: d.dayName,
          date: d.date,
          meals: d.meals.map((m) => ({
            mealTime: m.mealTime,
            foodItems: m.foodItems.map((fi) => fi._id),
          })),
        })),
      };

      const res = await saveWeeklyMenuDraftApi(payload);
      if (res.data?.data) {
        setMenu(res.data.data);
      }
      Alert.alert('Draft Saved', 'Menu draft has been saved. Remember to publish it when ready!');
      // Refresh weeks status
      const weeksRes = await getUpcomingWeeksApi();
      if (weeksRes.data?.data) setWeeks(weeksRes.data.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to save menu draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublishMenu = async () => {
    if (!menu || !selectedWeek) return;

    // Check if at least some meals are added
    const totalOptions = menu.days.reduce(
      (sum, d) => sum + d.meals.reduce((mSum, m) => mSum + m.foodItems.length, 0),
      0
    );

    if (totalOptions < 7) {
      Alert.alert(
        'Incomplete Schedule',
        'Please configure Breakfast, Lunch, and Dinner options across the 7 days before publishing.'
      );
      return;
    }

    setPublishing(true);
    try {
      // 1. Save latest changes first
      const payload = {
        title: menu.title,
        weekStartDate: selectedWeek.weekStartDate,
        days: menu.days.map((d) => ({
          dayName: d.dayName,
          date: d.date,
          meals: d.meals.map((m) => ({
            mealTime: m.mealTime,
            foodItems: m.foodItems.map((fi) => fi._id),
          })),
        })),
      };
      await saveWeeklyMenuDraftApi(payload);

      // 2. Publish
      const pubRes = await publishWeeklyMenuApi({
        weekStartDate: selectedWeek.weekStartDate,
      });

      if (pubRes.data?.data) {
        setMenu(pubRes.data.data);
      }

      setReviewModalVisible(false);
      Alert.alert(
        'Menu Published! 🚀',
        pubRes.data?.message || 'Customers can now select meals for this upcoming week.'
      );

      // Refresh weeks list
      const weeksRes = await getUpcomingWeeksApi();
      if (weeksRes.data?.data) {
        setWeeks(weeksRes.data.data);
        const updated = weeksRes.data.data.find(
          (w: any) => w.weekStartDate === selectedWeek.weekStartDate
        );
        if (updated) setSelectedWeek(updated);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to publish weekly menu.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading && !menu) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Week Selector Header */}
      <View style={styles.weekPickerContainer}>
        <Text style={styles.pickerSectionLabel}>Select Week to Configure:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekPillsScroll}
        >
          {weeks.map((w) => {
            const isSelected = selectedWeek?.weekStartDate === w.weekStartDate;
            const isPub = w.isPublished;

            return (
              <TouchableOpacity
                key={w.weekStartDate}
                style={[
                  styles.weekPill,
                  isSelected && styles.weekPillActive,
                ]}
                onPress={() => handleSelectWeek(w)}
              >
                <View style={styles.pillTopRow}>
                  <Text
                    style={[
                      styles.weekPillTitle,
                      isSelected && styles.weekPillTextActive,
                    ]}
                  >
                    {w.label}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      isPub ? styles.dotPublished : styles.dotDraft,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.weekPillDates,
                    isSelected && styles.weekPillTextActive,
                  ]}
                >
                  {new Date(w.weekStartDate).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  –{' '}
                  {new Date(w.weekEndDate).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Week Status & Cutoff Banner */}
      <View style={styles.weekStatusBanner}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.bannerStatusText}>
              Status: {menu?.isPublished ? '🟢 Published to Customers' : '🟡 Draft (Private)'}
            </Text>
          </View>
          <Text style={styles.bannerDeadlineText}>
            Customer Deadline: {selectedWeek?.selectionDeadlineFormatted || 'Thursday 11:59 PM'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => setReviewModalVisible(true)}
        >
          <Text style={styles.reviewBtnText}>Review 7-Days ›</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Day Tabs (Monday - Sunday) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
        contentContainerStyle={styles.dayScrollContent}
      >
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayTab, selectedDay === day && styles.dayTabActive]}
            onPress={() => setSelectedDay(day)}
          >
            <Text
              style={[
                styles.dayTabText,
                selectedDay === day && styles.dayTabTextActive,
              ]}
            >
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 4. Meals for Selected Day */}
      <ScrollView style={styles.mealList} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeaderTitle}>{selectedDay}'s Meals</Text>
          <Text style={styles.dayHeaderSub}>Manual Configuration (No Auto-repeat)</Text>
        </View>

        {(['breakfast', 'lunch', 'dinner'] as MealTime[]).map((mTime) => {
          const slot = currentDayData?.meals?.find((m) => m.mealTime === mTime);
          const assigned = slot?.foodItems || [];

          return (
            <View key={mTime} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotTitle}>
                  {mTime === 'breakfast' && '🌅 Breakfast Options'}
                  {mTime === 'lunch' && '☀️ Lunch Options'}
                  {mTime === 'dinner' && '🌙 Dinner Options'}
                </Text>

                <TouchableOpacity
                  style={styles.addDishBtn}
                  onPress={() => openPicker(mTime)}
                >
                  <Text style={styles.addDishText}>+ Add Option</Text>
                </TouchableOpacity>
              </View>

              {assigned.length === 0 ? (
                <Text style={styles.noDishesText}>
                  No options entered for {mTime} yet. Tap "+ Add Option" to add.
                </Text>
              ) : (
                assigned.map((dish) => (
                  <View key={dish._id} style={styles.dishRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      <Text style={styles.dishPrice}>${dish.price.toFixed(2)} AUD</Text>
                    </View>
                    <Badge type="diet" value={dish.dietType} />
                    <TouchableOpacity
                      onPress={() => handleRemoveDish(mTime, dish._id)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Action Buttons */}
        <View style={styles.footerActionRow}>
          <Button
            title="Save as Draft"
            onPress={handleSaveDraft}
            variant="outline"
            loading={savingDraft}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title={menu?.isPublished ? 'Update Published Menu' : 'Publish Menu 🚀'}
            onPress={handlePublishMenu}
            variant="primary"
            loading={publishing}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>

      {/* 5. Dish Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add Option for {selectedDay} {pickerMealTime.toUpperCase()}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={allItems.filter(
                (item) => item.category === pickerMealTime || item.category === 'snack' || item.category === 'lunch'
              )}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => handleAddDish(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{item.name}</Text>
                    <Text style={styles.pickerItemPrice}>
                      ${item.price.toFixed(2)} AUD • {item.category.toUpperCase()}
                    </Text>
                  </View>
                  <Badge type="diet" value={item.dietType} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No dishes found. Please create dishes in the Dishes tab first.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* 6. Complete 7-Day Review & Publish Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>7-Day Schedule Review</Text>
                <Text style={{ fontSize: 12, color: Colors.text.secondary }}>
                  Week of {selectedWeek?.weekStartDate ? new Date(selectedWeek.weekStartDate).toLocaleDateString('en-AU') : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {menu?.days?.map((d) => (
                <View key={d.dayName} style={styles.reviewDayCard}>
                  <Text style={styles.reviewDayTitle}>{d.dayName}</Text>
                  {d.meals.map((m) => (
                    <View key={m.mealTime} style={styles.reviewMealRow}>
                      <Text style={styles.reviewMealLabel}>{m.mealTime.toUpperCase()}:</Text>
                      <Text style={styles.reviewMealNames}>
                        {m.foodItems.length > 0
                          ? m.foodItems.map((f) => f.name).join(', ')
                          : 'No dishes set'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <Button
                title={menu?.isPublished ? 'Republish Week' : 'Confirm & Publish Week 🚀'}
                onPress={handlePublishMenu}
                loading={publishing}
              />
            </View>
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
  weekPickerContainer: {
    backgroundColor: Colors.surface,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.secondary,
    paddingHorizontal: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  weekPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  weekPill: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 150,
  },
  weekPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekPillTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  weekPillDates: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  weekPillTextActive: {
    color: Colors.text.inverse,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPublished: {
    backgroundColor: '#2D6A4F',
  },
  dotDraft: {
    backgroundColor: '#F4A261',
  },
  weekStatusBanner: {
    backgroundColor: '#FFF1E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F8D5C2',
  },
  bannerStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  bannerDeadlineText: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  reviewBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  reviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  dayScroll: {
    backgroundColor: Colors.surface,
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
  },
  dayTabActive: {
    backgroundColor: Colors.primary,
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  dayTabTextActive: {
    color: Colors.text.inverse,
  },
  mealList: {
    flex: 1,
  },
  dayHeaderRow: {
    marginBottom: 14,
  },
  dayHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  dayHeaderSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  slotCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  addDishBtn: {
    backgroundColor: '#FFE8D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addDishText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  noDishesText: {
    fontSize: 12,
    color: Colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  dishName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dishPrice: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  removeBtnText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  footerActionRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 40,
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeBtn: {
    fontSize: 18,
    color: Colors.text.muted,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  pickerItemPrice: {
    fontSize: 12,
    color: Colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.text.muted,
    paddingVertical: 20,
  },
  reviewDayCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewDayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  reviewMealRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  reviewMealLabel: {
    width: 80,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  reviewMealNames: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.secondary,
  },
});
