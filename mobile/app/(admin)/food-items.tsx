import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createFoodItemApi, deleteFoodItemApi, getFoodItemsApi, updateFoodItemApi } from '../../src/services/api';
import { DietType, FoodItem } from '../../src/types';
import { colors, radius, shadow } from '../../src/theme';
import { DishArt } from '../../src/components/brand/DishArt';
import { Segmented, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Field, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { aud } from '../../src/utils/money';

/** Animated on/off switch: knob slides and the track turns green when available. */
const Toggle: React.FC<{ on: boolean; onPress: () => void }> = ({ on, onPress }) => {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(on ? 20 : 0, { damping: 16, stiffness: 260 }) }] }));
  return (
    <PressableScale onPress={onPress} style={[styles.toggle, { backgroundColor: on ? colors.leaf : colors.line }]}>
      <Animated.View style={[styles.knob, knob]} />
    </PressableScale>
  );
};

export default function Dishes() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | DietType>('all');
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null); // null while adding a new dish
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [dietType, setDietType] = useState<DietType>('non-veg');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getFoodItemsApi();
      setItems(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (item: FoodItem) => {
    // Optimistic: flip immediately, roll back on failure
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, isAvailable: !i.isAvailable } : i)));
    try {
      await updateFoodItemApi(item._id, { isAvailable: !item.isAvailable });
    } catch {
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, isAvailable: item.isAvailable } : i)));
      Alert.alert('Error', 'Could not update availability.');
    }
  };

  const remove = (item: FoodItem) =>
    Alert.alert('Delete dish?', `"${item.name}" will be removed from the menu.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodItemApi(item._id);
            setItems((prev) => prev.filter((i) => i._id !== item._id));
          } catch {
            Alert.alert('Error', 'Could not delete the dish.');
          }
        },
      },
    ]);

  const openSheet = (item: FoodItem | null) => {
    setEditing(item);
    setName(item?.name || '');
    setDescription(item?.description || '');
    setPrice(item?.price ? String(item.price) : '');
    setDietType(item?.dietType || 'non-veg');
    setSheet(true);
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Name needed', 'Please enter the dish name.');
    const amount = Number(price.replace(/[$,\s]/g, ''));
    if (!price.trim() || !Number.isFinite(amount) || amount < 0) {
      return Alert.alert('Price needed', 'Enter the price of one meal in dollars, e.g. 16 or 16.50.');
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim(), dietType, price: Math.round(amount * 100) / 100 };
      if (editing) {
        const res = await updateFoodItemApi(editing._id, body);
        setItems((prev) => prev.map((i) => (i._id === editing._id ? res.data.data : i)).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const res = await createFoodItemApi(body);
        setItems((prev) => [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setSheet(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save the dish.');
    } finally {
      setSaving(false);
    }
  };

  const shown = items.filter((i) => filter === 'all' || i.dietType === filter);
  const available = items.filter((i) => i.isAvailable).length;
  const unpriced = items.filter((i) => !i.price).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={load} contentStyle={{ paddingBottom: 110 }}>
        <ScreenHeader overline={`${available} of ${items.length} available`} title="Dishes" />
        <Segmented
          options={[
            { label: 'All', value: 'all' },
            { label: 'Non-veg', value: 'non-veg' },
            { label: 'Veg', value: 'veg' },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as 'all' | DietType)}
          style={{ marginBottom: 16 }}
        />

        {!loading && unpriced > 0 && (
          <View style={styles.warn}>
            <Icon name="info" size={18} color="#8A5A00" />
            <Txt variant="caption" color="#8A5A00" style={{ flex: 1 }}>
              {unpriced} dish{unpriced > 1 ? 'es have' : ' has'} no price yet. Tap a dish to set it; bills add these up.
            </Txt>
          </View>
        )}

        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={78} style={{ marginBottom: 10 }} />)
        ) : shown.length === 0 ? (
          <EmptyState icon="cloche" title="No dishes" text="Add your first dish with the button below." />
        ) : (
          shown.map((item, i) => (
            <Animated.View
              key={item._id}
              entering={FadeInDown.delay(Math.min(i, 10) * 45).springify().damping(18)}
              exiting={FadeOut.duration(200)}
              layout={LinearTransition.springify().damping(18)}
            >
              <View style={[styles.row, !item.isAvailable && { opacity: 0.6 }]}>
                <DishArt name={item.name} size={54} />
                <PressableScale scaleTo={0.98} onPress={() => openSheet(item)} style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={2}>
                    {item.name}
                  </Txt>
                  <View style={styles.meta}>
                    <Badge type="diet" value={item.dietType} />
                    <Txt variant="label" color={item.price ? colors.brand : colors.chili}>
                      {item.price ? aud(item.price) : 'No price'}
                    </Txt>
                    <Txt variant="caption" color={item.isAvailable ? colors.leaf : colors.textMuted}>
                      {item.isAvailable ? 'Available' : 'Sold out'}
                    </Txt>
                  </View>
                </PressableScale>
                <Toggle on={item.isAvailable} onPress={() => toggle(item)} />
                <PressableScale onPress={() => remove(item)} hitSlop={8} style={styles.trash}>
                  <Icon name="trash" size={18} color={colors.textMuted} />
                </PressableScale>
              </View>
            </Animated.View>
          ))
        )}
      </Screen>

      <PressableScale onPress={() => openSheet(null)} style={[styles.fab, shadow.lifted]}>
        <Icon name="plus" size={20} color={colors.textOnDark} strokeWidth={2.2} />
        <Txt variant="label" color={colors.textOnDark}>
          Add dish
        </Txt>
      </PressableScale>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <View style={styles.preview}>
              <DishArt name={name || 'Rice'} size={64} />
              <View style={{ flex: 1 }}>
                <Txt variant="overline" color={colors.brand}>
                  {editing ? 'Edit dish' : 'New dish'}
                </Txt>
                <Txt variant="heading" numberOfLines={2}>
                  {name || 'Dish name'}
                </Txt>
              </View>
            </View>
            <Field label="Name" icon="cloche" placeholder="e.g. Porotta and Beef Fry" value={name} onChangeText={setName} />
            <Field
              label="Price per meal (AUD)"
              icon="cash"
              placeholder="e.g. 16.50"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
            <Field label="Description (optional)" icon="info" placeholder="Sides, spice level..." value={description} onChangeText={setDescription} />
            <Txt variant="label" color={colors.textSoft} style={{ marginBottom: 7 }}>
              Type
            </Txt>
            <Segmented
              options={[
                { label: 'Non-veg', value: 'non-veg' },
                { label: 'Veg', value: 'veg' },
              ]}
              value={dietType}
              onChange={(v) => setDietType(v as DietType)}
              style={{ marginBottom: 18 }}
            />
            <Button title={editing ? 'Save changes' : 'Add dish'} icon="check" onPress={submit} loading={saving} size="lg" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 14, borderRadius: radius.md, backgroundColor: colors.goldSoft },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  trash: { padding: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 16 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
});
