import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getBillsApi, setBillPaymentApi } from '../../src/services/api';
import { Bill, BillsWeek, PaymentMethod } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { BillBreakdown } from '../../src/components/BillBreakdown';
import { Appear, Segmented, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Field, IconButton, Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { addDays, fmtDate, messISODateOf } from '../../src/utils/date';
import { aud } from '../../src/utils/money';

const METHODS: { value: Exclude<PaymentMethod, 'other'>; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'bank_transfer', label: 'Bank transfer', icon: 'wallet' },
  { value: 'payid', label: 'PayID', icon: 'phone' },
];

const shortDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });
const initials = (name?: string) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function Bills() {
  const insets = useSafeAreaInsets();
  const [week, setWeek] = useState<BillsWeek | null>(null);
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = async (start = weekStart) => {
    try {
      const res = await getBillsApi(start);
      setWeek(res.data?.data || null);
    } catch {
      Alert.alert('Could not load', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever the tab is opened or the week changes
  useFocusEffect(
    useCallback(() => {
      load(weekStart);
    }, [weekStart])
  );

  const shiftWeek = (n: number) => {
    if (!week) return;
    const next = messISODateOf(addDays(week.weekStartDate, n * 7));
    setLoading(true);
    setOpen(null);
    setWeekStart(next);
  };

  const replace = (updated: Bill) => {
    setWeek((prev) => {
      if (!prev) return prev;
      const bills = prev.bills.map((b) => (b._id === updated._id ? updated : b));
      const paidAUD = bills.filter((b) => b.payment?.status === 'paid').reduce((n, b) => n + b.totalAUD, 0);
      return { ...prev, bills, summary: { ...prev.summary, paidAUD, unpaidAUD: prev.summary.totalAUD - paidAUD } };
    });
  };

  const openPayment = (bill: Bill) => {
    setPaying(bill);
    setMethod('cash');
    setReference('');
    setDone(null);
  };

  const recordPayment = async () => {
    if (!paying) return;
    setSaving(true);
    try {
      const res = await setBillPaymentApi(paying._id, { paid: true, method, reference: reference.trim() || undefined });
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

  const markUnpaid = (bill: Bill) =>
    Alert.alert('Mark as unpaid?', `${bill.customer?.name}'s ${aud(bill.totalAUD)} bill will show as not paid.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark unpaid',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await setBillPaymentApi(bill._id, { paid: false });
            replace(res.data.data);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Could not update the bill.');
          }
        },
      },
    ]);

  const shown = (week?.bills || []).filter((b) => filter === 'all' || (b.payment?.status === 'paid') === (filter === 'paid'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen onRefresh={() => load()}>
        <ScreenHeader
          overline={week ? `Week of ${shortDate(week.weekStartDate)} – ${shortDate(week.weekEndDate)}` : 'Weekly bills'}
          title="Bills"
          right={
            <View style={styles.weekNav}>
              <IconButton icon="chevronLeft" onPress={() => shiftWeek(-1)} />
              <IconButton icon="chevronRight" onPress={() => shiftWeek(1)} />
            </View>
          }
        />

        {loading || !week ? (
          <>
            <Skeleton height={96} style={{ marginBottom: 14 }} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={90} style={{ marginBottom: 12 }} />
            ))}
          </>
        ) : (
          <>
            <Appear index={1} style={styles.summary}>
              <View style={styles.sumCell}>
                <Txt variant="caption" color={colors.textSoft}>
                  Total
                </Txt>
                <Txt variant="heading">{aud(week.summary.totalAUD)}</Txt>
                <Txt variant="caption" color={colors.textMuted}>
                  {week.summary.bills} bill{week.summary.bills === 1 ? '' : 's'}
                </Txt>
              </View>
              <View style={styles.sumDivider} />
              <View style={styles.sumCell}>
                <Txt variant="caption" color={colors.textSoft}>
                  Paid
                </Txt>
                <Txt variant="heading" color={colors.leaf}>
                  {aud(week.summary.paidAUD)}
                </Txt>
              </View>
              <View style={styles.sumDivider} />
              <View style={styles.sumCell}>
                <Txt variant="caption" color={colors.textSoft}>
                  To collect
                </Txt>
                <Txt variant="heading" color="#8A5A00">
                  {aud(week.summary.unpaidAUD)}
                </Txt>
              </View>
            </Appear>

            <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 10, marginBottom: 14 }}>
              {week.ordersOpen
                ? `Customers can still change orders until ${week.deadlineFormatted}.`
                : week.ordersClosed
                  ? 'Orders for this week are final.'
                  : 'Ordering for this week has not opened yet.'}
            </Txt>

            <Segmented
              options={[
                { label: 'All', value: 'all' },
                { label: 'To pay', value: 'unpaid' },
                { label: 'Paid', value: 'paid' },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as 'all' | 'unpaid' | 'paid')}
              style={{ marginBottom: 16 }}
            />

            {shown.length === 0 ? (
              <EmptyState icon="receipt" title="No bills here" text="A bill appears as soon as a customer orders meals for this week." />
            ) : (
              shown.map((b, i) => {
                const paid = b.payment?.status === 'paid';
                const expanded = open === b._id;
                const meals = b.days.reduce((n, d) => n + d.items.reduce((s, it) => s + it.quantity, 0), 0);
                return (
                  <Appear key={b._id} index={Math.min(i, 8)}>
                    <Animated.View layout={LinearTransition.springify().damping(18)} style={[styles.card, !paid && styles.cardUnpaid]}>
                      <PressableScale onPress={() => setOpen(expanded ? null : b._id)} style={styles.top}>
                        <View style={styles.avatar}>
                          <Txt variant="label" color={colors.textOnDark} style={{ fontFamily: fonts.bold }}>
                            {initials(b.customer?.name)}
                          </Txt>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt variant="subheading" numberOfLines={1}>
                            {b.customer?.name || 'Customer'}
                          </Txt>
                          <Txt variant="caption" color={colors.textSoft}>
                            {meals} meal{meals === 1 ? '' : 's'}
                          </Txt>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Txt variant="subheading" style={{ fontFamily: fonts.extrabold }}>
                            {aud(b.totalAUD)}
                          </Txt>
                          <Badge type="payment" value={paid ? 'paid' : 'unpaid'} style={{ marginTop: 3 }} />
                        </View>
                      </PressableScale>

                      {expanded && (
                        <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 8 }}>
                          <BillBreakdown bill={b} />
                        </Animated.View>
                      )}

                      <View style={styles.actions}>
                        {paid ? (
                          <Button title="Mark unpaid" icon="refresh" size="sm" variant="ghost" onPress={() => markUnpaid(b)} style={{ flex: 1 }} />
                        ) : (
                          <Button title="Mark paid" icon="cash" size="sm" onPress={() => openPayment(b)} style={{ flex: 1 }} />
                        )}
                        {b.customer?.phone ? (
                          <PressableScale onPress={() => Linking.openURL(`tel:${b.customer.phone}`)} style={styles.call}>
                            <Icon name="phone" size={17} color={colors.leaf} />
                          </PressableScale>
                        ) : null}
                      </View>
                    </Animated.View>
                  </Appear>
                );
              })
            )}
          </>
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
                    Week of {shortDate(paying.weekStartDate)}
                  </Txt>
                  <Txt variant="heading" style={{ marginTop: 4 }}>
                    {paying.customer?.name}
                  </Txt>
                  <View style={styles.amount}>
                    <Txt variant="caption" color={colors.textSoft}>
                      Bill total
                    </Txt>
                    <Txt variant="hero" color={colors.brand}>
                      {aud(paying.totalAUD)}
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
                  <Field label="Reference (optional)" icon="receipt" placeholder="e.g. bank transfer ref" value={reference} onChangeText={setReference} />
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
  weekNav: { flexDirection: 'row', gap: 8, marginTop: 6 },
  summary: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.lineSoft },
  sumCell: { flex: 1, alignItems: 'center', gap: 2 },
  sumDivider: { width: 1, backgroundColor: colors.lineSoft, marginHorizontal: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.lineSoft },
  cardUnpaid: { borderColor: colors.gold, backgroundColor: '#FFFCF3' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  call: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
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
