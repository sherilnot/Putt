import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getMySubscriptionApi, getMyOrdersApi } from '../../src/services/api';
import { Order, Subscription } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHomeData = async () => {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [subRes, ordersRes] = await Promise.all([
        getMySubscriptionApi().catch(() => ({ data: { data: null } })),
        getMyOrdersApi(today).catch(() => ({ data: { data: [] } })),
      ]);

      if (subRes.data?.data) {
        setSubscription(subRes.data.data);
      } else {
        setSubscription(null);
      }

      setTodayOrders(
        (ordersRes.data?.data || [])
          .filter((o: Order) => o.status !== 'cancelled')
          .sort((a: Order, b: Order) => a.mealNumber - b.mealNumber)
      );
    } catch (e) {
      console.error('Failed to load customer home data:', e);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Namaskaram, {user?.name?.split(' ')[0] || 'Foodie'}! 🙏</Text>
          <Text style={styles.locationTag}>📍 Pick up fresh at the mess</Text>
        </View>
      </View>

      {/* Subscription Status Card */}
      {subscription && subscription.status === 'active' ? (
        <Card style={styles.activeSubCard}>
          <View style={styles.subCardTop}>
            <View>
              <Text style={styles.subPlanLabel}>ACTIVE SUBSCRIPTION</Text>
              <Text style={styles.subPlanName}>{subscription.plan?.name}</Text>
            </View>
            <Badge type="subscription" value={subscription.status} />
          </View>

          <Text style={styles.subDetail}>
            {subscription.plan?.mealsPerDay} meal{(subscription.plan?.mealsPerDay || 1) > 1 ? 's' : ''} a day · paid until{' '}
            {new Date(subscription.endDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </Text>

          <View style={styles.subCardBtnRow}>
            <TouchableOpacity
              style={styles.chooseMealBtn}
              onPress={() => router.push('/(customer)/menu')}
            >
              <Text style={styles.chooseMealBtnText}>Choose Your Meals ›</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        <Card style={styles.subscribePromoCard}>
          <Text style={styles.promoBadge}>FRESH DAILY MESS</Text>
          <Text style={styles.promoTitle}>Authentic Kerala Meals Every Day</Text>
          <Text style={styles.promoDesc}>
            Biriyani, Kabsa, Kappa and Beef, Puttu, Idiyappam and more. Choose 1, 2 or 3 meals a
            day and pick them up at a time that suits you.
          </Text>
          <Button
            title="Explore Subscription Plans"
            onPress={() => router.push('/(customer)/my-plan')}
            style={styles.promoBtn}
          />
        </Card>
      )}

      {/* Today's Meals */}
      <Text style={styles.sectionHeading}>Today's Meals</Text>
      {todayOrders.length > 0 ? (
        <Card style={styles.todayCard}>
          <View style={styles.todayHeaderRow}>
            <Text style={styles.todayMealTime}>
              PICKUP {todayOrders[0].pickupSlot?.label?.toUpperCase() || ''}
            </Text>
            <Badge type="status" value={todayOrders[0].status} />
          </View>
          {todayOrders.map((order) => (
            <View key={order._id} style={styles.todayRow}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>🍛</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.todaySlotText}>Meal {order.mealNumber}</Text>
                <Text style={styles.todayFoodName}>{order.foodItem?.name}</Text>
              </View>
              <Badge type="diet" value={order.foodItem?.dietType} />
            </View>
          ))}
        </Card>
      ) : (
        <Card style={styles.emptyTodayCard}>
          <Text style={styles.emptyTodayTitle}>No meals for today</Text>
          <Text style={styles.emptyTodaySub}>
            Choose next week's meals before Thursday night.
          </Text>
          <TouchableOpacity
            style={styles.pickTodayBtn}
            onPress={() => router.push('/(customer)/menu')}
          >
            <Text style={styles.pickTodayBtnText}>Choose My Meals ›</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Highlights Section */}
      <Text style={styles.sectionHeading}>Why Puttum Beefum Mess?</Text>
      <View style={styles.featuresRow}>
        <View style={styles.featureItem}>
          <Text style={styles.featureEmoji}>🥥</Text>
          <Text style={styles.featureTitle}>Pure Coconut Oil</Text>
          <Text style={styles.featureSub}>Traditional Kerala spices</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureEmoji}>🥘</Text>
          <Text style={styles.featureTitle}>15 Dishes</Text>
          <Text style={styles.featureSub}>Pick any, every day</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureEmoji}>⏱️</Text>
          <Text style={styles.featureTitle}>Your Pickup Time</Text>
          <Text style={styles.featureSub}>Ready when you arrive</Text>
        </View>
      </View>
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
  header: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  locationTag: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  activeSubCard: {
    backgroundColor: '#FAF5EE',
    borderColor: '#E8DCCB',
    padding: 18,
    marginBottom: 20,
  },
  subCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subPlanLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  subPlanName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  subDetail: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 10,
  },
  subCardBtnRow: {
    marginTop: 14,
    alignItems: 'flex-start',
  },
  chooseMealBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chooseMealBtnText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '700',
  },
  subscribePromoCard: {
    backgroundColor: '#FFEFE6',
    borderColor: '#F8D5C2',
    padding: 20,
    marginBottom: 20,
  },
  promoBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 4,
  },
  promoDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    lineHeight: 18,
  },
  promoBtn: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  todayCard: {
    padding: 14,
    marginBottom: 20,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayMealTime: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  todayFoodName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  todaySlotText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  emptyTodayCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: Colors.surface,
  },
  emptyTodayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptyTodaySub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  pickTodayBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickTodayBtnText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '600',
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  featureItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  featureSub: {
    fontSize: 10,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
});
