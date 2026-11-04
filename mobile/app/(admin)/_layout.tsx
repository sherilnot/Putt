import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...(props as any)}
          icons={{ dashboard: 'grid', menu: 'calendar', 'food-items': 'cloche', orders: 'chef', bills: 'receipt' }}
        />
      )}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Today' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="food-items" options={{ title: 'Dishes' }} />
      <Tabs.Screen name="orders" options={{ title: 'Kitchen' }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills' }} />
    </Tabs>
  );
}
