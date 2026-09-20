import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    if (!email || !password) return;

    const result = await login(email.trim(), password);
    if (result.success) {
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(customer)/home');
      }
    }
  };

  const fillDemoCustomer = () => {
    setEmail('andi@example.com.au');
    setPassword('Customer123!');
  };

  const fillDemoAdmin = () => {
    setEmail('admin@puttumbeefum.com.au');
    setPassword('Admin123!');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Header */}
        <View style={styles.header}>
          <Text style={styles.brandIcon}>🍛</Text>
          <Text style={styles.brandTitle}>Puttum Beefum</Text>
          <Text style={styles.brandSubtitle}>
            Kerala Mess & Daily Meal Subscriptions
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.aussieBadge}>🇦🇺 Sydney • Melbourne • Brisbane</Text>
          </View>
        </View>

        {/* Quick Demo Credentials */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>⚡ Quick Demo Sign-in:</Text>
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity style={styles.demoBtn} onPress={fillDemoCustomer}>
              <Text style={styles.demoBtnText}>Customer Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={fillDemoAdmin}>
              <Text style={styles.demoBtnText}>Admin (Mess Owner)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. andi@example.com.au"
              placeholderTextColor={Colors.text.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={Colors.text.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Button
            title="Log In"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.submitBtn}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to Puttum Beefum? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Create Customer Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandIcon: {
    fontSize: 54,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: 8,
  },
  aussieBadge: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: '#FFE8D6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  demoBox: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  form: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  errorBox: {
    backgroundColor: '#FFE3E3',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text.primary,
  },
  submitBtn: {
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
