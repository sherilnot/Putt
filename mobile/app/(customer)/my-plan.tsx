import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  getMySubscriptionApi,
  getCustomerPlansApi,
  subscribeApi,
  pauseSubscriptionApi,
  resumeSubscriptionApi,
  cancelSubscriptionApi,
} from '../../src/services/api';
import { Subscription, SubscriptionPlan } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

export default function CustomerMyPlan() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPlanData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        getMySubscriptionApi().catch(() => ({ data: { data: null } })),
        getCustomerPlansApi().catch(() => ({ data: { data: [] } })),
      ]);

      if (subRes.data?.data) {
        setSubscription(subRes.data.data);
      } else {
        setSubscription(null);
      }

      if (plansRes.data?.data) {
        setPlans(plansRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load plan details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanData();
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    Alert.alert(
      'Confirm Subscription',
      `Subscribe to ${plan.name} for $${plan.priceAUD} AUD per ${plan.intervalDays === 30 ? 'month' : 'week'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await subscribeApi({ planId: plan._id });
              if (res.data?.checkoutUrl) {
                // Paid plans activate once Stripe confirms payment (via webhook)
                setSubscription(res.data.subscription);
                await Linking.openURL(res.data.checkoutUrl);
              } else if (res.data?.subscription) {
                setSubscription(res.data.subscription);
                Alert.alert(
                  'Subscribed! 🎉',
                  'Your mess meal plan is now active. Go to Weekly Menu to pick your daily dishes!'
                );
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Failed to subscribe.';
              Alert.alert('Notice', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleTogglePause = async () => {
    if (!subscription) return;
    setActionLoading(true);
    try {
      const isPaused = subscription.status === 'paused';
      const res = isPaused ? await resumeSubscriptionApi() : await pauseSubscriptionApi();
      if (res.data?.data) {
        setSubscription({ ...subscription, ...res.data.data, plan: subscription.plan });
        Alert.alert(
          isPaused ? 'Resumed' : 'Paused',
          isPaused
            ? 'Welcome back! Pick your meals for the upcoming week.'
            : 'Your plan is paused and upcoming deliveries were cancelled.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your mess subscription?',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await cancelSubscriptionApi();
              setSubscription(null);
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } catch (e) {
              Alert.alert('Error', 'Failed to cancel subscription.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {subscription && (subscription.status === 'active' || subscription.status === 'paused') ? (
        <View>
          {/* Active Subscription Details */}
          <Card style={styles.activePlanCard}>
            <View style={styles.activeHeader}>
              <View>
                <Text style={styles.planHeaderLabel}>CURRENT MEAL PLAN</Text>
                <Text style={styles.currentPlanName}>
                  {subscription.plan?.name}
                </Text>
              </View>
              <Badge type="subscription" value={subscription.status} />
            </View>

            <View style={styles.pricingRow}>
              <Text style={styles.currentPrice}>
                ${subscription.plan?.priceAUD || 0} AUD
              </Text>
              <Text style={styles.currentInterval}>
                / {subscription.plan?.intervalDays || 7} days
              </Text>
            </View>

            <Text style={styles.planDesc}>{subscription.plan?.description}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Renews / Valid until:</Text>
              <Text style={styles.metaVal}>
                {new Date(subscription.endDate).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.subActionRow}>
              <Button
                title={subscription.status === 'active' ? 'Pause Plan' : 'Resume Plan'}
                onPress={handleTogglePause}
                variant="outline"
                loading={actionLoading}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Cancel Plan"
                onPress={handleCancelSubscription}
                variant="danger"
                loading={actionLoading}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Selected Meals in this cycle */}
          <Text style={styles.sectionTitle}>
            Selected Meals ({subscription.selectedMeals?.length || 0})
          </Text>
          {subscription.selectedMeals && subscription.selectedMeals.length > 0 ? (
            subscription.selectedMeals.map((sm, idx) => (
              <View key={idx} style={styles.selectedMealItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smDate}>
                    {new Date(sm.date).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    • {sm.mealTime.toUpperCase()}
                  </Text>
                  <Text style={styles.smFoodName}>{sm.foodItem?.name}</Text>
                  <Text style={styles.smSlot}>
                    Window: {sm.deliverySlot?.label || 'Standard Slot'}
                  </Text>
                </View>
                <Badge type="diet" value={sm.foodItem?.dietType} />
              </View>
            ))
          ) : (
            <Text style={styles.noSelections}>
              You haven't selected any meals yet. Open the "Weekly Menu" tab to pick your food!
            </Text>
          )}
        </View>
      ) : (
        <View>
          {subscription?.status === 'pending' && (
            <Card style={styles.planCard}>
              <Text style={styles.cardPlanName}>⏳ Payment pending</Text>
              <Text style={styles.introSub}>
                We're waiting for payment confirmation for {subscription.plan?.name || 'your plan'}.
                Choosing a plan again restarts checkout.
              </Text>
            </Card>
          )}

          {/* Plans Catalog */}
          <View style={styles.promoIntro}>
            <Text style={styles.introTitle}>Choose Your Mess Plan</Text>
            <Text style={styles.introSub}>
              All plans include daily prepared homestyle Kerala food cooked with authentic spices and fresh local produce in Australia.
            </Text>
          </View>

          {plans.map((plan) => (
            <Card key={plan._id} style={styles.planCard}>
              <View style={styles.planCardTop}>
                <Text style={styles.cardPlanName}>{plan.name}</Text>
                <View style={styles.priceTag}>
                  <Text style={styles.cardPrice}>${plan.priceAUD}</Text>
                  <Text style={styles.cardInterval}>
                    /{plan.intervalDays === 30 ? 'mo' : 'wk'}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardPlanDesc}>{plan.description}</Text>

              <View style={styles.planFeatures}>
                <Text style={styles.planFeatureText}>
                  ✓ {plan.mealsPerDay} meal{plan.mealsPerDay > 1 ? 's' : ''} per day
                </Text>
                <Text style={styles.planFeatureText}>
                  ✓ Rotating weekly menu selection
                </Text>
                <Text style={styles.planFeatureText}>
                  ✓ Pause or skip anytime
                </Text>
              </View>

              <Button
                title="Select & Subscribe"
                onPress={() => handleSubscribe(plan)}
                loading={actionLoading}
                style={{ marginTop: 14 }}
              />
            </Card>
          ))}
        </View>
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePlanCard: {
    padding: 20,
    marginBottom: 24,
    backgroundColor: Colors.surface,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  currentPlanName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  currentInterval: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  planDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 8,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subActionRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  selectedMealItem: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smDate: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  smFoodName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 2,
  },
  smSlot: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  noSelections: {
    color: Colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  promoIntro: {
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  introSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  planCard: {
    padding: 18,
    marginBottom: 14,
    backgroundColor: Colors.surface,
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardPlanName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    flex: 1,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  cardInterval: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  cardPlanDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    lineHeight: 18,
  },
  planFeatures: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 4,
  },
  planFeatureText: {
    fontSize: 12,
    color: Colors.text.primary,
  },
});
