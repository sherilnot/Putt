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
import { getMySubscriptionApi, getWeeklyMenuApi } from '../../src/services/api';
import { Subscription, WeeklyMenu } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHomeData = async () => {
    try {
      const [subRes, menuRes] = await Promise.all([
        getMySubscriptionApi().catch(() => ({ data: { data: null } })),
        getWeeklyMenuApi().catch(() => ({ data: { data: null } })),
      ]);

      if (subRes.data?.data) {
        setSubscription(subRes.data.data);
      } else {
        setSubscription(null);
      }

      if (menuRes.data?.data) {
        setWeeklyMenu(menuRes.data.data);
      }
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMeal = subscription?.selectedMeals?.find(
    (m) => new Date(m.date).toISOString().slice(0, 10) === todayStr
  );

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
          <Text style={styles.locationTag}>📍 Greater Sydney & Melbourne Deliveries</Text>
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

          <Text style={styles.subNextDelivery}>
            Default Slot: {subscription.defaultDeliverySlot?.label || '12:00 PM – 1:30 PM (Lunch)'}
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
          <Text style={styles.promoTitle}>Authentic Kerala Meals Delivered Every Day</Text>
          <Text style={styles.promoDesc}>
            Enjoy hot Puttu, Beef Roast, Fish Curry Meals, Malabar Biryani & Chapati delivered right to your door in Australia.
          </Text>
          <Button
            title="Explore Subscription Plans"
            onPress={() => router.push('/(customer)/my-plan')}
            style={styles.promoBtn}
          />
        </Card>
      )}

      {/* Today's Meal Banner */}
      <Text style={styles.sectionHeading}>Today's Selected Meal</Text>
      {todayMeal ? (
        <Card style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View style={styles.todayMealIcon}>
              <Text style={{ fontSize: 32 }}>🍛</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.todayHeaderRow}>
                <Text style={styles.todayMealTime}>{todayMeal.mealTime.toUpperCase()}</Text>
                <Badge type="diet" value={todayMeal.foodItem?.dietType} />
              </View>
              <Text style={styles.todayFoodName}>{todayMeal.foodItem?.name}</Text>
              <Text style={styles.todaySlotText}>
                Slot: {todayMeal.deliverySlot?.label || 'Standard Lunch'}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={styles.emptyTodayCard}>
          <Text style={styles.emptyTodayTitle}>No meal chosen for today yet!</Text>
          <Text style={styles.emptyTodaySub}>
            Browse this week's menu and pick your favorite dish.
          </Text>
          <TouchableOpacity
            style={styles.pickTodayBtn}
            onPress={() => router.push('/(customer)/menu')}
          >
            <Text style={styles.pickTodayBtnText}>Pick Today's Dish ›</Text>
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
          <Text style={styles.featureTitle}>Rotating Menu</Text>
          <Text style={styles.featureSub}>Different menu each day</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureEmoji}>⏱️</Text>
          <Text style={styles.featureTitle}>Slot Selection</Text>
          <Text style={styles.featureSub}>Delivered hot on time</Text>
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
  subNextDelivery: {
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
  todayMealIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FFE8D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
