import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { getMyBillsApi } from '../../src/services/api';
import { Bill } from '../../src/types';
import { colors, fonts, radius } from '../../src/theme';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { BillBreakdown } from '../../src/components/BillBreakdown';
import { Appear, Skeleton } from '../../src/components/ui/Motion';
import { EmptyState, Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';
import { fmtDate } from '../../src/utils/date';
import { aud } from '../../src/utils/money';

const WAYS: { icon: IconName; label: string }[] = [
  { icon: 'cash', label: 'Cash at the mess' },
  { icon: 'wallet', label: 'Bank transfer' },
  { icon: 'phone', label: 'PayID' },
];

const weekLabel = (b: Bill) =>
  `${fmtDate(b.weekStartDate, { day: 'numeric', month: 'short' })} – ${fmtDate(b.weekEndDate || b.weekStartDate, { day: 'numeric', month: 'short' })}`;

const METHOD: Record<string, string> = { cash: 'cash', bank_transfer: 'bank transfer', payid: 'PayID', other: 'other' };

export default function MyBills() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await getMyBillsApi();
      const data: Bill[] = res.data?.data || [];
      setBills(data);
      setOpen((prev) => prev ?? data[0]?._id ?? null);
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever the tab is opened, so changes made elsewhere show up
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const owing = bills.filter((b) => b.payment?.status !== 'paid').reduce((n, b) => n + b.totalAUD, 0);

  return (
    <Screen onRefresh={load}>
      <ScreenHeader overline="Pay the mess offline" title="Bills" />

      <Appear index={1}>
        {loading ? (
          <Skeleton height={150} rounded={radius.xl} />
        ) : (
          <HeroBackdrop style={styles.hero}>
            <Txt variant="overline" color={colors.gold}>
              {owing > 0 ? 'To pay' : 'All settled'}
            </Txt>
            <Txt variant="hero" color={colors.textOnDark} style={{ marginTop: 6 }}>
              {aud(owing)}
            </Txt>
            <View style={styles.ways}>
              {WAYS.map((w) => (
                <View key={w.label} style={styles.way}>
                  <Icon name={w.icon} size={15} color={colors.gold} />
                  <Txt variant="caption" color={colors.textOnDarkSoft}>
                    {w.label}
                  </Txt>
                </View>
              ))}
            </View>
          </HeroBackdrop>
        )}
      </Appear>

      <SectionTitle title="By week" />
      {loading ? (
        [0, 1].map((i) => <Skeleton key={i} height={90} style={{ marginBottom: 12 }} />)
      ) : bills.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No bills yet"
          text="When you order meals for a week, its bill appears here."
          action={<Button title="Order meals" icon="bowl" onPress={() => router.push('/(customer)/menu')} />}
        />
      ) : (
        bills.map((b, i) => {
          const expanded = open === b._id;
          const paid = b.payment?.status === 'paid';
          return (
            <Appear key={b._id} index={Math.min(i, 6)}>
              <Animated.View layout={LinearTransition.springify().damping(18)}>
                <Card style={styles.bill}>
                  <PressableScale onPress={() => setOpen(expanded ? null : b._id)} style={styles.billHead}>
                    <View style={[styles.billIcon, { backgroundColor: paid ? colors.leafSoft : colors.goldSoft }]}>
                      <Icon name="receipt" size={20} color={paid ? colors.leaf : '#8A5A00'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">Week of {weekLabel(b)}</Txt>
                      <Badge type="payment" value={paid ? 'paid' : 'unpaid'} style={{ marginTop: 4 }} />
                    </View>
                    <Txt variant="subheading" style={{ fontFamily: fonts.extrabold }}>
                      {aud(b.totalAUD)}
                    </Txt>
                    <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} color={colors.textMuted} />
                  </PressableScale>
                  {expanded && (
                    <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 6 }}>
                      <BillBreakdown bill={b} />
                      {paid && b.payment.paidAt && (
                        <Txt variant="caption" color={colors.leaf} style={{ marginTop: 8 }}>
                          Paid by {METHOD[b.payment.method || 'other']} on {fmtDate(b.payment.paidAt, { day: 'numeric', month: 'short' })}
                        </Txt>
                      )}
                    </Animated.View>
                  )}
                </Card>
              </Animated.View>
            </Appear>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 22 },
  ways: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  way: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bill: { marginBottom: 12 },
  billHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  billIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
