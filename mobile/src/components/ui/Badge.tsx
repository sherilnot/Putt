import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Txt } from './Txt';

interface BadgeProps {
  type: 'status' | 'diet' | 'payment';
  value: string;
  style?: ViewStyle;
}

// Indian food marks: green dot in a square for veg, red triangle in a square for non-veg
export const DietMark: React.FC<{ diet: string; size?: number }> = ({ diet, size = 14 }) => {
  const veg = diet !== 'non-veg';
  const c = veg ? colors.leaf : colors.chili;
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2" fill="#FFFFFF" stroke={c} strokeWidth="1.5" />
      {veg ? <Circle cx="7" cy="7" r="3.2" fill={c} /> : <Path d="M7 3.6 10.4 9.8H3.6Z" fill={c} />}
    </Svg>
  );
};

const TONES: Record<string, { fg: string; bg: string; label: string }> = {
  // orders
  pending: { fg: colors.textSoft, bg: colors.surfaceAlt, label: 'Scheduled' },
  preparing: { fg: colors.brand, bg: colors.brandSoft, label: 'Preparing' },
  ready: { fg: colors.sky, bg: colors.skySoft, label: 'Ready for pickup' },
  collected: { fg: colors.leaf, bg: colors.leafSoft, label: 'Collected' },
  cancelled: { fg: colors.chili, bg: colors.chiliSoft, label: 'Cancelled' },
  // bills
  paid: { fg: colors.leaf, bg: colors.leafSoft, label: 'Paid' },
  unpaid: { fg: '#8A5A00', bg: colors.goldSoft, label: 'To pay' },
};

export const Badge: React.FC<BadgeProps> = ({ type, value, style }) => {
  if (type === 'diet') {
    const veg = value !== 'non-veg';
    return (
      <View style={[styles.diet, style]}>
        <DietMark diet={value} />
        <Txt variant="caption" color={veg ? colors.leaf : colors.chili} style={styles.dietText}>
          {veg ? 'Veg' : 'Non-veg'}
        </Txt>
      </View>
    );
  }

  const tone = TONES[value] || { fg: colors.textSoft, bg: colors.surfaceAlt, label: value };

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Txt variant="caption" color={tone.fg} style={styles.pillText}>
        {tone.label}
      </Txt>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.bold },
  diet: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dietText: { fontFamily: fonts.semibold },
});
