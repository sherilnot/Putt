import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '../src/store/authStore';
import { BrandMark, Wordmark } from '../src/components/brand/BrandMark';
import { colors } from '../src/theme';

export default function IndexScreen() {
  const { user, isInitializing } = useAuthStore();
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }],
    opacity: 0.85 + breath.value * 0.15,
  }));

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <Animated.View style={pulse}>
          <BrandMark size={84} />
        </Animated.View>
        <View style={{ marginTop: 18 }}>
          <Wordmark size={24} />
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'admin') return <Redirect href="/(admin)/dashboard" />;
  return <Redirect href="/(customer)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
