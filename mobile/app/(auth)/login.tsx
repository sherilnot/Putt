import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, shadow } from '../../src/theme';
import { BrandMark, Wordmark } from '../../src/components/brand/BrandMark';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { Button } from '../../src/components/ui/Button';
import { Field } from '../../src/components/ui/Screen';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';

// Demo accounts only exist on a local seeded dev server
const SHOW_DEMO_LOGINS = __DEV__ && !process.env.EXPO_PUBLIC_API_URL;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    if (!email || !password) return;

    const result = await login(email.trim(), password);
    if (result.success) {
      const user = useAuthStore.getState().user;
      router.replace(user?.role === 'admin' ? '/(admin)/dashboard' : '/(customer)/home');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <HeroBackdrop style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <Animated.View entering={FadeInDown.duration(600).springify().damping(16)}>
            <BrandMark size={68} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(600).springify().damping(16)} style={{ marginTop: 18 }}>
            <Wordmark light size={32} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(220).duration(600)}>
            <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginTop: 8, maxWidth: 280 }}>
              Kerala mess meals, cooked fresh every day and ready when you are.
            </Txt>
          </Animated.View>
        </HeroBackdrop>

        <Animated.View entering={FadeInUp.delay(150).duration(650).springify().damping(18)} style={[styles.sheet, shadow.lifted]}>
          <Txt variant="heading">Welcome back</Txt>
          <Txt variant="body" color={colors.textSoft} style={{ marginTop: 4, marginBottom: 22 }}>
            Sign in to choose this week's meals.
          </Txt>

          {SHOW_DEMO_LOGINS && (
            <View style={styles.demoRow}>
              {[
                { label: 'Demo customer', email: 'customer@example.com', pw: 'Customer123!' },
                { label: 'Demo manager', email: 'admin@puttumkadalayum.com.au', pw: 'Admin123!' },
              ].map((d) => (
                <PressableScale
                  key={d.label}
                  style={styles.demoChip}
                  onPress={() => {
                    setEmail(d.email);
                    setPassword(d.pw);
                  }}
                >
                  <Icon name="sparkle" size={14} color={colors.brand} />
                  <Txt variant="caption" color={colors.brand}>
                    {d.label}
                  </Txt>
                </PressableScale>
              ))}
            </View>
          )}

          <Field
            label="Email"
            icon="mail"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            icon="lock"
            placeholder="Your password"
            secureTextEntry
            secureToggle
            value={password}
            onChangeText={setPassword}
          />

          {error && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.error}>
              <Icon name="info" size={17} color={colors.chili} />
              <Txt variant="label" color={colors.chili} style={{ flex: 1 }}>
                {error}
              </Txt>
            </Animated.View>
          )}

          <Button title="Sign in" icon="arrowRight" onPress={handleLogin} loading={isLoading} size="lg" style={{ marginTop: 6 }} />

          <View style={styles.footer}>
            <Txt variant="body" color={colors.textSoft}>
              New here?{' '}
            </Txt>
            <PressableScale onPress={() => router.push('/(auth)/register')}>
              <Txt variant="bodyStrong" color={colors.brand}>
                Create an account
              </Txt>
            </PressableScale>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: 26, paddingBottom: 70 },
  sheet: {
    flex: 1,
    marginTop: -36,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  demoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.chiliSoft,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 12,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 },
});
