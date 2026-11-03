import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '../../theme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Fades and springs content up into place; pass `index` to stagger lists. */
export const Appear: React.FC<{ index?: number; delay?: number; children: React.ReactNode; style?: ViewStyle }> = ({
  index = 0,
  delay = 0,
  children,
  style,
}) => (
  <Animated.View
    entering={FadeInDown.delay(delay + index * 70)
      .duration(520)
      .springify()
      .damping(18)}
    style={style}
  >
    {children}
  </Animated.View>
);

/** Shimmering placeholder block shown while content loads. */
export const Skeleton: React.FC<{ height: number; width?: number | `${number}%`; style?: ViewStyle; rounded?: number }> = ({
  height,
  width = '100%',
  style,
  rounded = radius.md,
}) => {
  const t = useSharedValue(0);
  const [w, setW] = useState(300);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, []);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-w, w]) }],
  }));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[{ height, width, borderRadius: rounded, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

/** Number that counts up to its value (dashboard stats). */
export const CountUp: React.FC<{ value: number | null | undefined; style?: any }> = ({ value, style }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value == null) return;
    const start = Date.now();
    const from = 0;
    const duration = 900;
    let frame: number;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text style={style}>{value == null ? '–' : shown}</Text>;
};

/** Pill selector whose highlight slides between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const segment = width / options.length;

  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 18, stiffness: 220 });
  }, [index, segment]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[seg.track, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 && <Animated.View style={[seg.thumb, { width: segment }, indicator]} />}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic={false}
            scaleTo={0.95}
            style={seg.option}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
          >
            <Txt variant="label" color={active ? colors.ink : colors.textMuted} style={{ fontFamily: fonts.bold }}>
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    shadowColor: '#4A3420',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  option: { flex: 1, alignItems: 'center', paddingVertical: 9 },
});
