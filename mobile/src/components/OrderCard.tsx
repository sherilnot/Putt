import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Order, OrderStatus } from '../types';
import { colors, fonts, radius, shadow } from '../theme';
import { DishArt } from './brand/DishArt';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';
import { Txt } from './ui/Txt';

interface OrderCardProps {
  order: Order;
  isAdmin?: boolean;
  onUpdateStatus?: (status: OrderStatus) => void;
}

const FLOW: OrderStatus[] = ['pending', 'preparing', 'ready', 'collected'];
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Ready for pickup' },
  ready: { status: 'collected', label: 'Mark collected' },
};

/** Four-step tracker: scheduled → preparing → ready → collected. */
const Progress: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const step = FLOW.indexOf(status);
  return (
    <View style={styles.progress}>
      {FLOW.map((s, i) => (
        <View key={s} style={[styles.segment, { backgroundColor: i <= step ? (status === 'collected' ? colors.leaf : colors.brand) : colors.surfaceAlt }]} />
      ))}
    </View>
  );
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, isAdmin = false, onUpdateStatus }) => {
  const next = NEXT[order.status];

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} style={[styles.card, shadow.soft]}>
      <View style={styles.row}>
        <DishArt name={order.foodItem?.name || ''} size={54} />
        <View style={{ flex: 1 }}>
          <Txt variant="overline" color={colors.textMuted}>
            Meal {order.mealNumber}
          </Txt>
          <Txt variant="subheading" numberOfLines={2}>
            {order.foodItem?.name || 'Meal'}
          </Txt>
          {order.foodItem?.dietType && <Badge type="diet" value={order.foodItem.dietType} style={{ marginTop: 4 }} />}
        </View>
        <Badge type="status" value={order.status} />
      </View>

      {order.status !== 'cancelled' && <Progress status={order.status} />}

      {isAdmin && order.customer && (
        <View style={styles.customer}>
          <View style={styles.initial}>
            <Txt variant="label" color={colors.textOnDark} style={{ fontFamily: fonts.bold }}>
              {order.customer.name?.[0]?.toUpperCase() || '?'}
            </Txt>
          </View>
          <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {order.customer.name}
          </Txt>
          {order.customer.phone ? (
            <PressableScale onPress={() => Linking.openURL(`tel:${order.customer.phone}`)} style={styles.call}>
              <Icon name="phone" size={16} color={colors.leaf} />
            </PressableScale>
          ) : null}
        </View>
      )}

      {isAdmin && next && onUpdateStatus && (
        <Button
          title={next.label}
          icon={next.status === 'collected' ? 'check' : next.status === 'ready' ? 'bag' : 'chef'}
          size="sm"
          variant={next.status === 'collected' ? 'secondary' : 'primary'}
          onPress={() => onUpdateStatus(next.status)}
          style={{ marginTop: 12 }}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  progress: { flexDirection: 'row', gap: 4, marginTop: 14 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  customer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  initial: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  call: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
});
