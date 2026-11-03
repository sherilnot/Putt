import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { confirmSubscriptionPaymentApi, getAllSubscriptionsApi, updateSubscriptionStatusApi } from '../../src/services/api';
import { PaymentMethod, Subscription } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Field, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { fmtDate } from '../../src/utils/date';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'To confirm', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
];

const METHODS: { value: Exclude<PaymentMethod, 'other'>; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'bank_transfer', label: 'Bank transfer', icon: 'wallet' },
  { value: 'payid', label: 'PayID', icon: 'phone' },
];

const shortDay = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Customers() {
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [paying, setPaying] = useState<Subscription | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await getAllSubscriptionsApi();
      setAll(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': all.length };
    all.forEach((s) => (c[s.status] = (c[s.status] || 0) + 1));
    return c;
  }, [all]);
  // Requests waiting for payment first, then everyone else
  const shown = all
    .filter((s) => !filter || s.status === filter)
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));

  const replace = (updated: Subscription) => setAll((prev) => prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s)));

  const openPayment = (sub: Subscription) => {
    setPaying(sub);
    setMethod('cash');
    setReference('');
    setDone(null);
  };

  const recordPayment = async () => {
    if (!paying) return;
    setSaving(true);
    try {
      const res = await confirmSubscriptionPaymentApi(paying._id, { method, reference: reference.trim() || undefined });
      replace(res.data.data);
      setDone(res.data.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setPaying(null), 1400);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  const togglePause = (sub: Subscription) => {
    const next = sub.status === 'active' ? 'paused' : 'active';
    Alert.alert(next === 'paused' ? 'Pause plan?' : 'Reactivate plan?', next === 'paused' ? "Their upcoming meals will be cancelled." : '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: next === 'paused' ? 'Pause' : 'Reactivate',
        onPress: async () => {
          try {
            const res = await updateSubscriptionStatusApi(sub._id, next);
            replace(res.data.data);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Could not update the plan.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={load}>
        <ScreenHeader overline={`${counts.active || 0} active`} title="Customers" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const n = counts[f.value] || 0;
            return (
              <PressableScale key={f.label} onPress={() => setFilter(f.value)} style={[styles.chip, active && styles.chipActive]}>
                <Txt variant="label" color={active ? colors.textOnDark : colors.textSoft} style={{ fontFamily: fonts.bold }}>
                  {f.label}
                </Txt>
                {n > 0 && (
                  <View style={[styles.count, active && { backgroundColor: colors.gold }, f.value === 'pending' && !active && { backgroundColor: colors.goldSoft }]}>
                    <Txt variant="caption" color={active ? colors.ink : colors.textSoft} style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                      {n}
                    </Txt>
                  </View>
                )}
              </PressableScale>
            );
          })}
        </ScrollView>

        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={150} style={{ marginBottom: 12 }} />)
        ) : shown.length === 0 ? (
          <EmptyState icon="users" title="No customers here" text="Customers appear once they request a plan." />
        ) : (
          shown.map((s, i) => {
            const pending = s.status === 'pending';
            return (
              <Appear key={s._id} index={Math.min(i, 8)}>
                <View style={[styles.card, pending && styles.cardPending]}>
                  <View style={styles.top}>
                    <View style={styles.avatar}>
                      <Txt variant="label" color={colors.textOnDark} style={{ fontFamily: fonts.bold }}>
                        {(s.customer?.name || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="subheading" numberOfLines={1}>
                        {s.customer?.name || 'Customer'}
                      </Txt>
                      <Txt variant="caption" color={colors.textSoft} numberOfLines={1}>
                        {s.customer?.email}
                      </Txt>
                    </View>
                    {s.customer?.phone ? (
                      <PressableScale onPress={() => Linking.openURL(`tel:${s.customer.phone}`)} style={styles.call}>
                        <Icon name="phone" size={17} color={colors.leaf} />
                      </PressableScale>
                    ) : null}
                  </View>

                  <View style={styles.planRow}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{s.plan?.name || 'Plan'}</Txt>
                      <Txt variant="caption" color={colors.textSoft}>
                        ${s.plan?.priceAUD} / {s.plan?.intervalDays === 30 ? 'month' : 'week'}
                        {!pending && s.status !== 'cancelled' ? ` · paid until ${shortDay(s.endDate)}` : ''}
                      </Txt>
                    </View>
                    <Badge type="subscription" value={s.status} />
                  </View>

                  {s.status !== 'cancelled' && (
                    <View style={styles.actions}>
                      <Button
                        title={pending ? 'Confirm payment' : 'Record payment'}
                        icon="cash"
                        size="sm"
                        variant={pending ? 'primary' : 'outline'}
                        onPress={() => openPayment(s)}
                        style={{ flex: 1 }}
                      />
                      {(s.status === 'active' || s.status === 'paused') && (
                        <Button
                          title={s.status === 'active' ? 'Pause' : 'Reactivate'}
                          icon={s.status === 'active' ? 'pause' : 'play'}
                          size="sm"
                          variant="outline"
                          onPress={() => togglePause(s)}
                        />
                      )}
                    </View>
                  )}
                </View>
              </Appear>
            );
          })
        )}
      </Screen>

      {/* Payment sheet */}
      <Modal visible={paying !== null} transparent animationType="slide" onRequestClose={() => setPaying(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPaying(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            {done ? (
              <View style={styles.done}>
                <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneCircle}>
                  <Icon name="check" size={40} color={colors.textOnDark} strokeWidth={2.6} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(150)}>
                  <Txt variant="heading" align="center" style={{ marginTop: 18 }}>
                    Payment recorded
                  </Txt>
                  <Txt variant="body" color={colors.textSoft} align="center" style={{ marginTop: 6 }}>
                    {done}
                  </Txt>
                </Animated.View>
              </View>
            ) : (
              paying && (
                <>
                  <Txt variant="overline" color={colors.brand}>
                    {paying.status === 'pending' ? 'Confirm payment' : 'Record renewal'}
                  </Txt>
                  <Txt variant="heading" style={{ marginTop: 4 }}>
                    {paying.customer?.name}
                  </Txt>
                  <View style={styles.amount}>
                    <Txt variant="caption" color={colors.textSoft}>
                      {paying.plan?.name}
                    </Txt>
                    <Txt variant="hero" color={colors.brand}>
                      ${paying.plan?.priceAUD}
                    </Txt>
                  </View>
                  <Txt variant="label" color={colors.textSoft} style={{ marginBottom: 8 }}>
                    How did they pay?
                  </Txt>
                  <View style={styles.methods}>
                    {METHODS.map((m) => {
                      const on = method === m.value;
                      return (
                        <PressableScale key={m.value} onPress={() => setMethod(m.value)} style={[styles.method, on && styles.methodOn]}>
                          <Icon name={m.icon} size={22} color={on ? colors.gold : colors.textSoft} filled={on} />
                          <Txt variant="caption" color={on ? colors.textOnDark : colors.text} style={{ fontFamily: fonts.bold, marginTop: 6 }}>
                            {m.label}
                          </Txt>
                        </PressableScale>
                      );
                    })}
                  </View>
                  <Field
                    label="Reference (optional)"
                    icon="receipt"
                    placeholder="e.g. bank transfer ref"
                    value={reference}
                    onChangeText={setReference}
                  />
                  <Button title="Confirm payment received" icon="check" onPress={recordPayment} loading={saving} size="lg" />
                </>
              )
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chipScroll: { marginHorizontal: -20, marginBottom: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  count: { minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.lineSoft },
  cardPending: { borderColor: colors.gold, backgroundColor: '#FFFCF3' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  call: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 16 },
  amount: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: colors.lineSoft },
  methods: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  method: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft },
  methodOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  done: { alignItems: 'center', paddingVertical: 30 },
  doneCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
});
