import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  cancelSubscriptionApi,
  getCustomerPlansApi,
  getMySubscriptionApi,
  pauseSubscriptionApi,
  resumeSubscriptionApi,
  subscribeApi,
} from '../../src/services/api';
import { Subscription, SubscriptionPlan } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { fmtDate } from '../../src/utils/date';

const fmt = (d: string) => fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
const METHOD: Record<string, { label: string; icon: IconName }> = {
  cash: { label: 'Cash', icon: 'cash' },
  bank_transfer: { label: 'Bank transfer', icon: 'wallet' },
  payid: { label: 'PayID', icon: 'phone' },
  other: { label: 'Other', icon: 'wallet' },
};

const MealBowls: React.FC<{ count: number; light?: boolean }> = ({ count, light }) => (
  <View style={{ flexDirection: 'row', gap: 4 }}>
    {[1, 2, 3].map((n) => (
      <Icon
        key={n}
        name="bowl"
        size={18}
        filled={n <= count}
        color={n <= count ? (light ? colors.gold : colors.brand) : light ? 'rgba(255,255,255,0.25)' : colors.line}
      />
    ))}
  </View>
);

export default function MyPlan() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    const [subRes, plansRes] = await Promise.all([
      getMySubscriptionApi().catch(() => ({ data: { data: null } })),
      getCustomerPlansApi().catch(() => ({ data: { data: [] } })),
    ]);
    setSubscription(subRes.data?.data || null);
    setPlans(plansRes.data?.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const request = (plan: SubscriptionPlan) => {
    Alert.alert(
      'Request this plan?',
      `${plan.name}: $${plan.priceAUD} AUD per ${plan.intervalDays === 30 ? 'month' : 'week'}.\n\nYou'll pay the mess directly (cash, bank transfer or PayID). Your plan starts once they confirm.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Send request',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await subscribeApi({ planId: plan._id });
              setSubscription(res.data.subscription);
              Alert.alert('Request sent', res.data.message);
            } catch (err: any) {
              Alert.alert('Notice', err.response?.data?.message || 'Could not send the request.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const togglePause = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      const paused = subscription.status === 'paused';
      const res = paused ? await resumeSubscriptionApi() : await pauseSubscriptionApi();
      setSubscription({ ...subscription, ...res.data.data, plan: subscription.plan });
      Alert.alert(paused ? 'Welcome back' : 'Plan paused', paused ? 'Choose your meals for the coming week.' : 'Your upcoming meals were cancelled.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update your plan.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    const pending = subscription?.status === 'pending';
    Alert.alert(pending ? 'Withdraw request?' : 'Cancel plan?', pending ? 'Only do this if you have not paid yet.' : 'Your upcoming meals will be cancelled.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: pending ? 'Withdraw' : 'Cancel plan',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelSubscriptionApi();
            setSubscription(null);
          } catch {
            Alert.alert('Error', 'Could not cancel.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const weeklyThree = plans.find((p) => p.mealsPerDay === 3 && p.intervalDays === 7);

  return (
    <Screen onRefresh={load}>
      <ScreenHeader overline="Membership" title="Your plan" />

      {loading ? (
        <>
          <Skeleton height={200} rounded={radius.xl} />
          <Skeleton height={120} style={{ marginTop: 14 }} />
        </>
      ) : subscription && (subscription.status === 'active' || subscription.status === 'paused') ? (
        <>
          <Appear>
            <HeroBackdrop style={styles.member}>
              <View style={styles.memberTop}>
                <Txt variant="overline" color={colors.gold}>
                  Member
                </Txt>
                <Badge type="subscription" value={subscription.status} />
              </View>
              <Txt variant="title" color={colors.textOnDark} style={{ marginTop: 10 }}>
                {subscription.plan?.name}
              </Txt>
              <View style={styles.memberRow}>
                <MealBowls count={subscription.plan?.mealsPerDay || 1} light />
                <Txt variant="label" color={colors.textOnDarkSoft}>
                  {subscription.plan?.mealsPerDay} meal{(subscription.plan?.mealsPerDay || 1) > 1 ? 's' : ''} a day, any dish
                </Txt>
              </View>
              <View style={styles.divider} />
              <View style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color={colors.textOnDarkSoft}>
                    Paid until
                  </Txt>
                  <Txt variant="subheading" color={colors.textOnDark}>
                    {fmt(subscription.endDate)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption" color={colors.textOnDarkSoft}>
                    Price
                  </Txt>
                  <Txt variant="subheading" color={colors.gold}>
                    ${subscription.plan?.priceAUD} / {subscription.plan?.intervalDays === 30 ? 'month' : 'week'}
                  </Txt>
                </View>
              </View>
            </HeroBackdrop>
          </Appear>

          <Appear index={1} style={styles.actions}>
            <Button
              title={subscription.status === 'paused' ? 'Resume' : 'Pause'}
              icon={subscription.status === 'paused' ? 'play' : 'pause'}
              variant="outline"
              onPress={togglePause}
              loading={busy}
              style={{ flex: 1 }}
            />
            <Button title="Cancel plan" variant="danger" onPress={cancel} style={{ flex: 1 }} />
          </Appear>

          {subscription.payments && subscription.payments.length > 0 && (
            <>
              <SectionTitle title="Payments" />
              {[...subscription.payments].reverse().map((p, i) => (
                <Appear key={p._id} index={i + 2}>
                  <Card style={styles.payment}>
                    <View style={styles.payIcon}>
                      <Icon name={METHOD[p.method]?.icon || 'wallet'} size={20} color={colors.leaf} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">
                        ${p.amountAUD} · {METHOD[p.method]?.label || p.method}
                      </Txt>
                      <Txt variant="caption" color={colors.textSoft}>
                        Covers {fmt(p.periodStart)} – {fmt(p.periodEnd)}
                      </Txt>
                    </View>
                    <Icon name="checkCircle" size={20} color={colors.leaf} />
                  </Card>
                </Appear>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {subscription?.status === 'pending' && (
            <Appear>
              <Card style={{ marginBottom: 8 }}>
                <View style={styles.memberTop}>
                  <Txt variant="overline" color={colors.brand}>
                    Request sent
                  </Txt>
                  <Badge type="subscription" value="pending" />
                </View>
                <Txt variant="heading" style={{ marginTop: 8 }}>
                  {subscription.plan?.name}
                </Txt>
                {[
                  { label: 'Plan requested', done: true },
                  { label: `Pay the mess $${subscription.plan?.priceAUD} (cash, bank transfer or PayID)`, done: false, current: true },
                  { label: 'Manager confirms and your plan starts', done: false },
                ].map((s, i) => (
                  <View key={i} style={styles.step}>
                    <View style={[styles.stepDot, s.done && styles.stepDone, s.current && styles.stepCurrent]}>
                      {s.done ? (
                        <Icon name="check" size={13} color={colors.textOnDark} strokeWidth={2.4} />
                      ) : (
                        <Txt variant="caption" color={s.current ? colors.brand : colors.textMuted} style={{ fontFamily: fonts.bold }}>
                          {i + 1}
                        </Txt>
                      )}
                    </View>
                    <Txt variant={s.current ? 'bodyStrong' : 'body'} color={s.done || s.current ? colors.text : colors.textMuted} style={{ flex: 1 }}>
                      {s.label}
                    </Txt>
                  </View>
                ))}
                <Button title="Withdraw request" variant="outline" size="sm" onPress={cancel} style={{ marginTop: 16 }} />
              </Card>
            </Appear>
          )}

          {subscription?.status !== 'pending' && (
            <>
              <Appear>
                <Txt variant="body" color={colors.textSoft} style={{ marginBottom: 16 }}>
                  Choose how many meals you'd like each day. Pick any of our 15 dishes and collect them at your time.
                </Txt>
              </Appear>
              {plans.map((plan, i) => {
                const isSelected = selected === plan._id;
                const monthly = plan.intervalDays === 30;
                const saving = monthly && weeklyThree ? Math.round(weeklyThree.priceAUD * (30 / 7) - plan.priceAUD) : 0;
                return (
                  <Appear key={plan._id} index={i}>
                    <PressableScale onPress={() => setSelected(plan._id)} style={[styles.planCard, isSelected && styles.planSelected]}>
                      <View style={styles.planTop}>
                        <View style={{ flex: 1 }}>
                          {monthly && (
                            <View style={styles.bestValue}>
                              <Icon name="sparkle" size={12} color={colors.ink} />
                              <Txt variant="caption" color={colors.ink} style={{ fontFamily: fonts.bold }}>
                                Best value{saving > 0 ? ` · save $${saving}` : ''}
                              </Txt>
                            </View>
                          )}
                          <Txt variant="subheading">{plan.name}</Txt>
                          <View style={[styles.memberRow, { marginTop: 8 }]}>
                            <MealBowls count={plan.mealsPerDay} />
                            <Txt variant="caption" color={colors.textSoft}>
                              {plan.mealsPerDay} meal{plan.mealsPerDay > 1 ? 's' : ''} a day
                            </Txt>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Txt variant="title" color={colors.brand}>
                            ${plan.priceAUD}
                          </Txt>
                          <Txt variant="caption" color={colors.textMuted}>
                            per {monthly ? 'month' : 'week'}
                          </Txt>
                        </View>
                      </View>
                      {isSelected && (
                        <Appear>
                          <Txt variant="body" color={colors.textSoft} style={{ marginTop: 12 }}>
                            {plan.description}
                          </Txt>
                          <Button title="Request this plan" icon="arrowRight" onPress={() => request(plan)} loading={busy} style={{ marginTop: 14 }} />
                        </Appear>
                      )}
                    </PressableScale>
                  </Appear>
                );
              })}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: { borderRadius: radius.xl, padding: 22 },
  memberTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, padding: 14 },
  payIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  stepCurrent: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.lineSoft,
  },
  planSelected: { borderColor: colors.brand, backgroundColor: '#FFFBF6' },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bestValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 8,
  },
});
