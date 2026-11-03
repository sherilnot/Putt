import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, shadow } from '../../src/theme';
import { Wordmark } from '../../src/components/brand/BrandMark';
import { HeroBackdrop } from '../../src/components/brand/HeroBackdrop';
import { Button } from '../../src/components/ui/Button';
import { Field, IconButton } from '../../src/components/ui/Screen';
import { Icon } from '../../src/components/ui/Icon';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { Txt } from '../../src/components/ui/Txt';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registerCustomer, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const handleRegister = async () => {
    clearError();
    if (!name || !email || !password) return;

    const result = await registerCustomer({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
    });

    if (result.success) {
      router.replace('/(customer)/home');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <HeroBackdrop style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <IconButton icon="chevronLeft" onPress={() => router.back()} />
          <Animated.View entering={FadeInDown.duration(600).springify().damping(16)} style={{ marginTop: 22 }}>
            <Txt variant="overline" color={colors.gold}>
              Join
            </Txt>
            <Wordmark light size={30} />
            <Txt variant="body" color={colors.textOnDarkSoft} style={{ marginTop: 8 }}>
              Choose your meals each week and collect them fresh from the mess.
            </Txt>
          </Animated.View>
        </HeroBackdrop>

        <Animated.View entering={FadeInUp.delay(120).duration(650).springify().damping(18)} style={[styles.sheet, shadow.lifted]}>
          <Field label="Full name" icon="user" placeholder="Your name" value={name} onChangeText={setName} />
          <Field
            label="Email"
            icon="mail"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            icon="lock"
            placeholder="At least 8 characters"
            secureTextEntry
            secureToggle
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label="Mobile (so the mess can reach you)"
            icon="phone"
            placeholder="04xx xxx xxx"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {error && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.error}>
              <Icon name="info" size={17} color={colors.chili} />
              <Txt variant="label" color={colors.chili} style={{ flex: 1 }}>
                {error}
              </Txt>
            </Animated.View>
          )}

          <Button title="Create account" icon="arrowRight" onPress={handleRegister} loading={isLoading} size="lg" style={{ marginTop: 6 }} />

          <View style={styles.footer}>
            <Txt variant="body" color={colors.textSoft}>
              Already a member?{' '}
            </Txt>
            <PressableScale onPress={() => router.push('/(auth)/login')}>
              <Txt variant="bodyStrong" color={colors.brand}>
                Sign in
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
  hero: { paddingHorizontal: 24, paddingBottom: 64 },
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
