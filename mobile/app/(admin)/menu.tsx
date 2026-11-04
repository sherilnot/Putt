import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getAdminMenuApi, getFoodItemsApi, saveAdminMenuApi } from '../../src/services/api';
import { AdminMenu, DayName, FoodItem } from '../../src/types';
import { colors, fonts, radius, shadow } from '../../src/theme';
import { DishArt } from '../../src/components/brand/DishArt';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { IconButton, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { addDays, fmtDate, messISODateOf } from '../../src/utils/date';
import { aud } from '../../src/utils/money';

const DISHES_PER_DAY = 3;
const shortDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });

export default function WeeklyMenu() {
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [dishes, setDishes] = useState<FoodItem[]>([]);
  const [days, setDays] = useState<Record<string, (string | null)[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<{ day: DayName; slot: number } | null>(null);

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d._id, d])), [dishes]);
  const editable = Boolean(menu?.isOpen);

  const load = async (weekStart?: string) => {
    try {
      const [menuRes, dishRes] = await Promise.all([getAdminMenuApi(weekStart), getFoodItemsApi()]);
      const data: AdminMenu = menuRes.data.data;
      setMenu(data);
      setDishes(dishRes.data?.data || []);
      setDays(
        Object.fromEntries(
          data.days.map((d) => [d.dayName, Array.from({ length: DISHES_PER_DAY }, (_, i) => d.dishes[i] ?? null)])
        )
      );
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

  const shiftWeek = (n: number) => {
    if (!menu) return;
    const go = () => {
      setLoading(true);
      load(messISODateOf(addDays(menu.weekStartDate, n * 7)));
    };
    if (!dirty) return go();
    Alert.alert('Discard changes?', "This week's menu isn't saved yet.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: go },
    ]);
  };

  const choose = (dishId: string | null) => {
    if (!picker) return;
    const slots = [...days[picker.day]];
    slots[picker.slot] = dishId;
    setDays((prev) => ({ ...prev, [picker.day]: slots }));
    setDirty(true);
    Haptics.selectionAsync().catch(() => {});
    setPicker(null);
  };

  const copyMonday = () => {
    const monday = days.Monday;
    setDays((prev) => Object.fromEntries(Object.keys(prev).map((d) => [d, [...monday]])));
    setDirty(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const save = async () => {
    if (!menu) return;
    setSaving(true);
    try {
      const res = await saveAdminMenuApi({
        weekStartDate: messISODateOf(addDays(menu.weekStartDate, 0)),
        days: menu.days.map((d) => ({ dayName: d.dayName, dishes: (days[d.dayName] || []).filter((x): x is string => Boolean(x)) })),
      });
      setMenu(res.data.data);
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Menu saved', res.data?.message || 'The menu is saved.');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Not saved', err.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !menu) {
    return (
      <Screen>
        <Skeleton height={30} width="60%" style={{ marginTop: 16 }} />
        <Skeleton height={70} style={{ marginTop: 22 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={150} style={{ marginTop: 12 }} />
        ))}
      </Screen>
    );
  }

  const status = menu.isOpen
    ? { icon: 'clock' as const, fg: colors.leaf, text: `Open now. Save by ${menu.deadlineFormatted}.` }
    : menu.isLocked
      ? { icon: 'lock' as const, fg: colors.chili, text: 'This menu is locked. Customers order from it.' }
      : { icon: 'calendar' as const, fg: '#8A5A00', text: `You can set this menu from ${fmtDate(menu.opensAt, { weekday: 'long', day: 'numeric', month: 'short' })}.` };
  const pickedForDay = picker ? days[picker.day] : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={() => load(messISODateOf(addDays(menu.weekStartDate, 0)))} contentStyle={{ paddingBottom: dirty ? 110 : 40 }}>
        <ScreenHeader
          overline={`Week of ${shortDate(menu.weekStartDate)} – ${shortDate(menu.weekEndDate)}`}
          title="Menu"
          right={
            <View style={styles.weekNav}>
              <IconButton icon="chevronLeft" onPress={() => shiftWeek(-1)} />
              <IconButton icon="chevronRight" onPress={() => shiftWeek(1)} />
            </View>
          }
        />

        <Appear index={1}>
          <Card variant="tint" style={styles.notice}>
            <Icon name={status.icon} size={20} color={status.fg} />
            <Txt variant="body" color={colors.textSoft} style={{ flex: 1 }}>
              {status.text}
            </Txt>
          </Card>
        </Appear>

        {editable && days.Monday?.some(Boolean) && (
          <PressableScale onPress={copyMonday} style={styles.copy}>
            <Icon name="refresh" size={14} color={colors.brand} />
            <Txt variant="caption" color={colors.brand} style={{ fontFamily: fonts.bold }}>
              Copy Monday to every day
            </Txt>
          </PressableScale>
        )}

        {menu.days.map((d, i) => {
          const slots = days[d.dayName] || [];
          const count = slots.filter(Boolean).length;
          return (
            <Appear key={d.dayName} index={Math.min(i + 2, 8)}>
              <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.day}>
                <View style={styles.dayHead}>
                  <Txt variant="subheading">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</Txt>
                  <Txt variant="caption" color={count ? colors.textMuted : colors.chili}>
                    {count ? `${count} of ${DISHES_PER_DAY}` : 'Closed'}
                  </Txt>
                </View>
                {slots.map((id, k) => {
                  const dish = id ? dishById[id] : null;
                  return (
                    <PressableScale
                      key={k}
                      disabled={!editable}
                      onPress={() => setPicker({ day: d.dayName, slot: k })}
                      style={[styles.slot, dish && styles.slotFilled]}
                    >
                      {dish ? (
                        <DishArt name={dish.name} size={40} />
                      ) : (
                        <View style={styles.slotPlus}>
                          <Icon name="plus" size={18} color={colors.brand} />
                        </View>
                      )}
                      <Txt variant="bodyStrong" color={dish ? colors.text : colors.textSoft} style={{ flex: 1 }} numberOfLines={1}>
                        {dish ? dish.name : id ? 'Dish removed' : `Dish ${k + 1}`}
                      </Txt>
                      {dish && (
                        <Txt variant="label" color={colors.brand}>
                          {aud(dish.price)}
                        </Txt>
                      )}
                    </PressableScale>
                  );
                })}
              </Animated.View>
            </Appear>
          );
        })}
      </Screen>

      {dirty && editable && (
        <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.saveBar, shadow.lifted]}>
          <Txt variant="label" color={colors.textOnDark} style={{ flex: 1 }}>
            Unsaved changes
          </Txt>
          <Button title="Save menu" icon="check" size="sm" onPress={save} loading={saving} />
        </Animated.View>
      )}

      {/* Dish picker */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View>
              <Txt variant="overline" color={colors.brand}>
                {picker?.day} · Dish {(picker?.slot ?? 0) + 1}
              </Txt>
              <Txt variant="heading">Pick a dish</Txt>
            </View>
            <PressableScale onPress={() => choose(null)} style={styles.clearBtn}>
              <Txt variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.bold }}>
                Empty
              </Txt>
            </PressableScale>
          </View>
          <FlatList
            data={dishes}
            keyExtractor={(d) => d._id}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected = picker !== null && pickedForDay[picker.slot] === item._id;
              const elsewhere = !selected && pickedForDay.includes(item._id);
              return (
                <PressableScale
                  disabled={elsewhere}
                  onPress={() => choose(item._id)}
                  style={[styles.option, selected && styles.optionOn, (elsewhere || !item.isAvailable) && { opacity: 0.45 }]}
                >
                  <DishArt name={item.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </Txt>
                    <View style={styles.optionMeta}>
                      <Badge type="diet" value={item.dietType} />
                      {!item.isAvailable && (
                        <Txt variant="caption" color={colors.chili}>
                          Sold out
                        </Txt>
                      )}
                      {elsewhere && (
                        <Txt variant="caption" color={colors.textMuted}>
                          Already on this day
                        </Txt>
                      )}
                    </View>
                  </View>
                  <Txt variant="label" color={colors.brand}>
                    {aud(item.price)}
                  </Txt>
                  {selected && <Icon name="checkCircle" size={20} color={colors.brand} />}
                </PressableScale>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', gap: 8, marginTop: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  day: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.lineSoft },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    marginTop: 6,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  slotFilled: { borderStyle: 'solid', borderColor: colors.lineSoft, backgroundColor: colors.bg },
  slotPlus: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.4,
    borderColor: colors.lineSoft,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: '#FFF8F2' },
  optionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
});
