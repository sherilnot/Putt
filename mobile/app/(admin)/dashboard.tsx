import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getDashboardStatsApi } from '../../src/services/api';
import { Colors } from '../../src/constants/colors';
import { Card } from '../../src/components/ui/Card';
import { DashboardStats } from '../../src/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await getDashboardStatsApi();
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const todayFormatted = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View>
          <Text style={styles.welcomeText}>Hello, {user?.name || 'Owner'} 👋</Text>
          <Text style={styles.dateText}>{todayFormatted}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>👥</Text>
          <Text style={styles.statNumber}>
            {stats ? stats.activeSubscribers : '--'}
          </Text>
          <Text style={styles.statLabel}>Active Subscribers</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>📦</Text>
          <Text style={styles.statNumber}>
            {stats ? stats.todaysOrders : '--'}
          </Text>
          <Text style={styles.statLabel}>Today's Orders</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>⏳</Text>
          <Text style={styles.statNumber}>
            {stats ? stats.pendingOrders : '--'}
          </Text>
          <Text style={styles.statLabel}>Pending Prep</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>🍛</Text>
          <Text style={styles.statNumber}>
            {stats ? stats.totalFoodItems : '--'}
          </Text>
          <Text style={styles.statLabel}>Total Dishes</Text>
        </Card>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Management</Text>

      <TouchableOpacity
        style={styles.actionRow}
        activeOpacity={0.8}
        onPress={() => router.push('/(admin)/orders')}
      >
        <View style={[styles.actionIconBg, { backgroundColor: '#FFE8D6' }]}>
          <Text style={styles.actionEmoji}>🛵</Text>
        </View>
        <View style={styles.actionDetails}>
          <Text style={styles.actionTitle}>Kitchen & Dispatch Orders</Text>
          <Text style={styles.actionSub}>Track preparation and delivery slots</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionRow}
        activeOpacity={0.8}
        onPress={() => router.push('/(admin)/menu-manager')}
      >
        <View style={[styles.actionIconBg, { backgroundColor: '#D8F3DC' }]}>
          <Text style={styles.actionEmoji}>📅</Text>
        </View>
        <View style={styles.actionDetails}>
          <Text style={styles.actionTitle}>Weekly Menu Planner</Text>
          <Text style={styles.actionSub}>Assign daily breakfast, lunch, and dinner items</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionRow}
        activeOpacity={0.8}
        onPress={() => router.push('/(admin)/food-items')}
      >
        <View style={[styles.actionIconBg, { backgroundColor: '#E0F2FE' }]}>
          <Text style={styles.actionEmoji}>🍛</Text>
        </View>
        <View style={styles.actionDetails}>
          <Text style={styles.actionTitle}>Food Item Catalog</Text>
          <Text style={styles.actionSub}>Add, update price, or toggle dish availability</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionRow}
        activeOpacity={0.8}
        onPress={() => router.push('/(admin)/subscribers')}
      >
        <View style={[styles.actionIconBg, { backgroundColor: '#F3E8FF' }]}>
          <Text style={styles.actionEmoji}>👥</Text>
        </View>
        <View style={styles.actionDetails}>
          <Text style={styles.actionTitle}>Customer Subscriptions</Text>
          <Text style={styles.actionSub}>Manage active, paused, and weekly plans</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
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
  headerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  dateText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 18,
    marginVertical: 0,
  },
  statEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  actionRow: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionEmoji: {
    fontSize: 22,
  },
  actionDetails: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  actionSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: Colors.text.muted,
    fontWeight: '700',
  },
});
