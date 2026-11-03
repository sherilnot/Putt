import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, shadow } from '../theme';
import { Icon, IconName } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';
import { Txt } from './ui/Txt';

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  // Expo Router's tab bar API (SDK 58): emit tab events, then navigate by route key
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
  icons: Record<string, IconName>;
}

// Floating frosted tab bar; a dark pill slides behind the active tab.
export const TabBar: React.FC<TabBarProps> = ({ state, descriptors, emitter, navigateToTab, icons }) => {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabWidth = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(state.index * tabWidth, { damping: 18, stiffness: 200, mass: 0.8 });
  }, [state.index, tabWidth]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, shadow.lifted]}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.inner} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Animated.View style={[styles.pill, { width: tabWidth - 8 }, pill]} />
          )}
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const title = descriptors[route.key]?.options.title ?? route.name;
            return (
              <PressableScale
                key={route.key}
                haptic={false}
                scaleTo={0.92}
                style={styles.tab}
                onPress={() => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    Haptics.selectionAsync().catch(() => {});
                    navigateToTab(route.key);
                  }
                }}
              >
                <Icon
                  name={icons[route.name] ?? 'grid'}
                  size={22}
                  color={focused ? colors.gold : colors.textSoft}
                  filled={focused}
                />
                <Txt
                  variant="caption"
                  color={focused ? colors.textOnDark : colors.textSoft}
                  style={{ fontFamily: focused ? fonts.bold : fonts.semibold, fontSize: 10.5, marginTop: 3 }}
                  numberOfLines={1}
                >
                  {title}
                </Txt>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 6 },
  bar: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,253,249,0.82)',
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  inner: { flexDirection: 'row', paddingVertical: 8 },
  pill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
});
