import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bill } from '../types';
import { colors, fonts } from '../theme';
import { DietMark } from './ui/Badge';
import { Txt } from './ui/Txt';
import { fmtDate } from '../utils/date';
import { aud } from '../utils/money';

/** Day-by-day lines of a weekly bill: "2 × Chicken Biriyani   $32", then the total. */
export const BillBreakdown: React.FC<{ bill: Bill }> = ({ bill }) => (
  <View>
    {bill.days
      .filter((d) => d.items.length > 0)
      .map((d) => (
        <View key={d.dayName} style={styles.day}>
          <View style={styles.dayHead}>
            <Txt variant="label">{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</Txt>
            {d.pickupSlot && (
              <Txt variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {d.pickupSlot.label}
              </Txt>
            )}
          </View>
          {d.items.map((item, i) => (
            <View key={i} style={styles.line}>
              {item.foodItem && <DietMark diet={item.foodItem.dietType} size={12} />}
              <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {item.quantity} × {item.foodItem?.name || 'Dish removed'}
              </Txt>
              <Txt variant="body" color={colors.textSoft}>
                {aud(item.price * item.quantity)}
              </Txt>
            </View>
          ))}
        </View>
      ))}
    <View style={styles.total}>
      <Txt variant="bodyStrong">Total</Txt>
      <Txt variant="subheading" style={{ fontFamily: fonts.extrabold }}>
        {aud(bill.totalAUD)}
      </Txt>
    </View>
  </View>
);

const styles = StyleSheet.create({
  day: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
});
