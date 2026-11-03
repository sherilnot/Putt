import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// Logo: a puttu cylinder (rice and coconut layers) beside a bowl of kadala curry.
export const BrandMark: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#C25A2C" />
        <Stop offset="1" stopColor="#7E2B12" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="64" height="64" rx="18" fill="url(#bm-bg)" />
    {/* puttu */}
    <Rect x="15" y="12" width="16" height="36" rx="4" fill="#FBF5EC" />
    <Rect x="15" y="21" width="16" height="3.2" fill="#E9D8BC" />
    <Rect x="15" y="30" width="16" height="3.2" fill="#E9D8BC" />
    <Rect x="15" y="39" width="16" height="3.2" fill="#E9D8BC" />
    <Ellipse cx="23" cy="12.5" rx="8" ry="2.6" fill="#FFFFFF" />
    {/* kadala curry bowl */}
    <Path d="M30 40h22a11 9 0 0 1-22 0Z" fill="#2A1E16" />
    <Ellipse cx="41" cy="40" rx="11" ry="3" fill="#5C2410" />
    <Circle cx="37" cy="39.6" r="2.1" fill="#D9A441" />
    <Circle cx="42" cy="38.8" r="2.1" fill="#E7BE62" />
    <Circle cx="46.4" cy="40.2" r="2" fill="#D9A441" />
  </Svg>
);

export const Wordmark: React.FC<{ light?: boolean; size?: number }> = ({ light = false, size = 26 }) => (
  <View>
    <Text style={[styles.word, { fontSize: size, color: light ? colors.textOnDark : colors.ink }]}>
      Puttum <Text style={[styles.italic, { color: light ? colors.gold : colors.brand }]}>Kadalayum</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  word: { fontFamily: fonts.display, letterSpacing: -0.4 },
  italic: { fontFamily: fonts.displayItalic },
});
