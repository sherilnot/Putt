import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { gradients } from '../../theme';

// Gold "chickpeas" drifting slowly over a dark espresso gradient.
const PEAS = [
  { left: '8%', top: 26, size: 14, delay: 0, drift: 10 },
  { left: '78%', top: 18, size: 22, delay: 400, drift: 14 },
  { left: '62%', top: 92, size: 10, delay: 900, drift: 8 },
  { left: '88%', top: 120, size: 16, delay: 200, drift: 12 },
  { left: '20%', top: 140, size: 9, delay: 1300, drift: 9 },
  { left: '44%', top: 34, size: 7, delay: 700, drift: 6 },
] as const;

const Pea: React.FC<(typeof PEAS)[number]> = ({ left, top, size, delay, drift }) => {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: t.value * drift }, { rotate: `${t.value * 25}deg` }],
    opacity: 0.18 + t.value * 0.22,
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2 },
        styles.pea,
        style,
      ]}
    />
  );
};

export const HeroBackdrop: React.FC<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }> = ({ style, children }) => (
  <View style={[styles.wrap, style]}>
    <LinearGradient colors={gradients.ink} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {/* warm glow in the corner */}
    <LinearGradient
      colors={['rgba(194,90,44,0.55)', 'rgba(194,90,44,0)']}
      start={{ x: 1, y: 0 }}
      end={{ x: 0.3, y: 0.8 }}
      style={StyleSheet.absoluteFill}
    />
    {PEAS.map((p, i) => (
      <Pea key={i} {...p} />
    ))}
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  pea: { backgroundColor: '#E2B04A', borderWidth: 1, borderColor: 'rgba(255,240,200,0.6)' },
});
