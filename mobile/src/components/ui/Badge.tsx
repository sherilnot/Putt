import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { DietType, OrderStatus, SubscriptionStatus } from '../../types';

interface BadgeProps {
  label?: string;
  type?: 'diet' | 'status' | 'subscription' | 'category';
  value?: DietType | OrderStatus | SubscriptionStatus | string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  type = 'diet',
  value,
  style,
}) => {
  let bgColor = '#EEEEEE';
  let textColor = '#333333';
  let displayLabel = label || String(value || '');

  if (type === 'diet') {
    if (value === 'veg') {
      bgColor = Colors.diet.vegBg;
      textColor = Colors.diet.veg;
      displayLabel = 'VEG';
    } else if (value === 'non-veg') {
      bgColor = Colors.diet.nonVegBg;
      textColor = Colors.diet.nonVeg;
      displayLabel = 'NON-VEG';
    } else if (value === 'vegan') {
      bgColor = Colors.diet.veganBg;
      textColor = Colors.diet.vegan;
      displayLabel = 'VEGAN';
    }
  } else if (type === 'status') {
    if (value === 'pending') {
      bgColor = Colors.status.pendingBg;
      textColor = Colors.status.pending;
      displayLabel = 'Pending';
    } else if (value === 'preparing') {
      bgColor = Colors.status.preparingBg;
      textColor = Colors.status.preparing;
      displayLabel = 'Preparing';
    } else if (value === 'ready') {
      bgColor = Colors.status.readyBg;
      textColor = Colors.status.ready;
      displayLabel = 'Ready for Pickup';
    } else if (value === 'collected') {
      bgColor = Colors.status.collectedBg;
      textColor = Colors.status.collected;
      displayLabel = 'Collected';
    } else if (value === 'cancelled') {
      bgColor = Colors.status.cancelledBg;
      textColor = Colors.status.cancelled;
      displayLabel = 'Cancelled';
    }
  } else if (type === 'subscription') {
    if (value === 'active') {
      bgColor = '#D8F3DC';
      textColor = '#2D6A4F';
      displayLabel = 'ACTIVE';
    } else if (value === 'paused') {
      bgColor = '#FFE8D6';
      textColor = '#E85D04';
      displayLabel = 'PAUSED';
    } else if (value === 'pending') {
      bgColor = '#FFF3BF';
      textColor = '#8D6E00';
      displayLabel = 'AWAITING PAYMENT';
    } else {
      bgColor = '#FFE3E3';
      textColor = '#D90429';
      displayLabel = String(value).toUpperCase();
    }
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      <Text style={[styles.text, { color: textColor }]}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
