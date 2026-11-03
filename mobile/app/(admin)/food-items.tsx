import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import {
  getFoodItemsApi,
  createFoodItemApi,
  updateFoodItemApi,
  deleteFoodItemApi,
} from '../../src/services/api';
import { FoodItem, DietType } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

export default function AdminFoodItems() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dietFilter, setDietFilter] = useState<'all' | DietType>('all');
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dietType, setDietType] = useState<DietType>('non-veg');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dietTypes: DietType[] = ['non-veg', 'veg', 'vegan'];
  const filters: ('all' | DietType)[] = ['all', 'non-veg', 'veg'];

  const fetchItems = async () => {
    try {
      const res = await getFoodItemsApi();
      if (res.data?.data) {
        setItems(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching food items:', e);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const handleToggleAvailability = async (item: FoodItem) => {
    try {
      const updated = await updateFoodItemApi(item._id, {
        isAvailable: !item.isAvailable,
      });
      if (updated.data?.data) {
        setItems((prev) =>
          prev.map((it) => (it._id === item._id ? updated.data.data : it))
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update availability.');
    }
  };

  const handleDeleteItem = (id: string, itemName: string) => {
    Alert.alert('Delete Dish', `Are you sure you want to delete "${itemName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodItemApi(id);
            setItems((prev) => prev.filter((i) => i._id !== id));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete food item.');
          }
        },
      },
    ]);
  };

  const handleCreateItem = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter the dish name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createFoodItemApi({
        name: name.trim(),
        description: description.trim(),
        dietType,
        imageUrl: imageUrl.trim(),
      });

      if (res.data?.data) {
        setItems((prev) => [res.data.data, ...prev]);
        setModalVisible(false);
        // Reset form
        setName('');
        setDescription('');
        setImageUrl('');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create food item.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => dietFilter === 'all' || item.dietType === dietFilter);

  return (
    <View style={styles.container}>
      {/* Diet Filter Pills */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, dietFilter === f && styles.filterPillActive]}
            onPress={() => setDietFilter(f)}
          >
            <Text style={[styles.filterPillText, dietFilter === f && styles.filterPillTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
              </View>
              <Badge type="diet" value={item.dietType} />
            </View>

            {item.description ? (
              <Text style={styles.itemDesc}>{item.description}</Text>
            ) : null}

            <View style={styles.itemFooter}>
              <TouchableOpacity
                style={[
                  styles.availToggle,
                  item.isAvailable ? styles.availYes : styles.availNo,
                ]}
                onPress={() => handleToggleAvailability(item)}
              >
                <Text
                  style={[
                    styles.availText,
                    item.isAvailable ? styles.availTextYes : styles.availTextNo,
                  ]}
                >
                  {item.isAvailable ? '● Available' : '○ Sold Out'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteItem(item._id, item.name)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No dishes found.</Text>
          </View>
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+ Add Dish</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Dish</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Dish Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chicken Biriyani"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Diet Type</Text>
              <View style={styles.radioRow}>
                {dietTypes.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.radioChip, dietType === d && styles.radioChipActive]}
                    onPress={() => setDietType(d)}
                  >
                    <Text
                      style={[
                        styles.radioChipText,
                        dietType === d && styles.radioChipTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                placeholder="Describe flavors, ingredients, sides included..."
                multiline
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.label}>Image URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                value={imageUrl}
                onChangeText={setImageUrl}
              />

              <Button
                title="Save Dish"
                onPress={handleCreateItem}
                loading={submitting}
                style={{ marginTop: 16, marginBottom: 30 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  filterPillTextActive: {
    color: Colors.text.inverse,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  itemDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  availToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  availYes: {
    backgroundColor: '#D8F3DC',
  },
  availNo: {
    backgroundColor: '#E9ECEF',
  },
  availText: {
    fontSize: 12,
    fontWeight: '700',
  },
  availTextYes: {
    color: '#2D6A4F',
  },
  availTextNo: {
    color: '#6C757D',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  fabIcon: {
    color: Colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: Colors.text.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeBtn: {
    fontSize: 18,
    color: Colors.text.muted,
    padding: 4,
  },
  modalBody: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FAF7F2',
  },
  radioChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioChipText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
  },
  radioChipTextActive: {
    color: Colors.text.inverse,
    fontWeight: '700',
  },
});
