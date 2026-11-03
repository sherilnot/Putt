import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...(props as any)}
          icons={{ home: 'home', menu: 'bowl', 'my-plan': 'wallet', orders: 'bag', profile: 'user' }}
        />
      )}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="menu" options={{ title: 'My Meals' }} />
      <Tabs.Screen name="my-plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="orders" options={{ title: 'Pickups' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
