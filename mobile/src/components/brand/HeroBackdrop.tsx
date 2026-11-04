import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { gradients } from '../../theme';

// Still gold "chickpeas" scattered over a dark espresso gradient.
const PEAS = [
  { left: '8%', top: 26, size: 14, opacity: 0.28 },
  { left: '78%', top: 18, size: 22, opacity: 0.34 },
  { left: '62%', top: 92, size: 10, opacity: 0.22 },
  { left: '88%', top: 120, size: 16, opacity: 0.3 },
  { left: '20%', top: 140, size: 9, opacity: 0.2 },
  { left: '44%', top: 34, size: 7, opacity: 0.18 },
] as const;

/** A soft band of light that sweeps across the card once when it appears. */
const Sheen: React.FC<{ width: number }> = ({ width }) => {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(350, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }));
  }, []);
  const band = width * 0.45;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -band * 1.5 + t.value * (width + band * 3) }, { rotate: '18deg' }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, { width: band }, style]}>
      <LinearGradient
        colors={['rgba(255,240,210,0)', 'rgba(255,240,210,0.16)', 'rgba(255,240,210,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

export const HeroBackdrop: React.FC<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }> = ({ style, children }) => {
  const [width, setWidth] = useState(0);
  return (
    <View style={[styles.wrap, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <LinearGradient colors={gradients.ink} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* warm glow in the corner */}
      <LinearGradient
        colors={['rgba(194,90,44,0.55)', 'rgba(194,90,44,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      {PEAS.map((p, i) => (
        <View
          key={i}
          style={[styles.pea, { left: p.left, top: p.top, width: p.size, height: p.size, borderRadius: p.size / 2, opacity: p.opacity }]}
        />
      ))}
      {width > 0 && <Sheen width={width} />}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  pea: { position: 'absolute', backgroundColor: '#E2B04A', borderWidth: 1, borderColor: 'rgba(255,240,200,0.6)' },
  sheen: { position: 'absolute', top: -60, bottom: -60 },
});
