import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { Card } from '../../src/components/ui/Card';

export default function CustomerProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'PB';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name || 'Customer'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* Account Info */}
      <Card style={styles.card}>
        <Text style={styles.cardHeading}>Personal Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user?.phone || 'Not provided'}</Text>
        </View>
      </Card>

      {/* About Mess */}
      <Card style={styles.card}>
        <Text style={styles.cardHeading}>Puttum Beefum Mess Australia</Text>
        <Text style={styles.aboutText}>
          Authentic Kerala home-cooked mess meals, prepared fresh every day with genuine spices and cold-pressed coconut oil. Choose your dishes, then pick them up at the mess at the time that suits you.
        </Text>
        <View style={styles.tagRow}>
          <Text style={styles.tag}>🇦🇺 Fresh In Australia</Text>
          <Text style={styles.tag}>🍛 100% Homestyle</Text>
        </View>
      </Card>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Sign Out of Puttum Beefum</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Puttum Beefum v1.0.0 • Made with ❤️</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.inverse,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  card: {
    padding: 18,
    marginBottom: 14,
    backgroundColor: Colors.surface,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  aboutText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: '#FFE8D6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logoutBtn: {
    backgroundColor: '#FFE3E3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFC9C9',
  },
  logoutBtnText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 20,
  },
});
