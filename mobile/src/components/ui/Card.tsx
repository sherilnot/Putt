import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadow } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'dark' | 'tint';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  if (variant === 'dark') {
    return (
      <LinearGradient
        colors={gradients.ink}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.dark, shadow.lifted, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.card, variant === 'tint' ? styles.tint : styles.light, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18 },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, ...shadow.soft },
  tint: { backgroundColor: colors.surfaceAlt },
  dark: { overflow: 'hidden' },
});
