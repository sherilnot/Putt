import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { FoodItem } from '../types';
import { Colors } from '../constants/colors';
import { Badge } from './ui/Badge';

interface FoodItemCardProps {
  item: FoodItem;
  isSelected?: boolean;
  onSelect?: () => void;
  onPress?: () => void;
  actionText?: string;
  showSelectButton?: boolean;
}

export const FoodItemCard: React.FC<FoodItemCardProps> = ({
  item,
  isSelected = false,
  onSelect,
  onPress,
  actionText = 'Select',
  showSelectButton = false,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
      ]}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>🍛</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Badge type="diet" value={item.dietType} />
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          <Text style={styles.price}>${item.price.toFixed(2)} AUD</Text>

          {showSelectButton && onSelect && (
            <TouchableOpacity
              style={[styles.selectBtn, isSelected && styles.selectedBtn]}
              onPress={onSelect}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectBtnText,
                  isSelected && styles.selectedBtnText,
                ]}
              >
                {isSelected ? '✓ Selected' : actionText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedContainer: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFBF5',
  },
  image: {
    width: 100,
    height: 100,
    backgroundColor: '#EEE',
  },
  placeholderImage: {
    width: 100,
    height: 100,
    backgroundColor: '#FFE8D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 6,
  },
  description: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginVertical: 4,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  selectedBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  selectedBtnText: {
    color: Colors.text.inverse,
  },
});
