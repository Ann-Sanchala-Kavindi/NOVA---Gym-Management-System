import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';

export default function MemberTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
          marginBottom: 10,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="dumbbell" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shop/index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} />,
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="active-workout" options={{ href: null }} />
      <Tabs.Screen name="workout-history" options={{ href: null }} />
      <Tabs.Screen name="book-session" options={{ href: null }} />
      <Tabs.Screen name="booking-history" options={{ href: null }} />
      <Tabs.Screen name="shop/[productId]" options={{ href: null }} />
      <Tabs.Screen name="shop/cart" options={{ href: null }} />
      <Tabs.Screen name="about-us" options={{ href: null }} />
      <Tabs.Screen name="my-bookings" options={{ href: null }} />
      <Tabs.Screen name="sessions" options={{ href: null }} />
      <Tabs.Screen name="track-progress" options={{ href: null }} />
      <Tabs.Screen name="tutorial-categories" options={{ href: null }} />
      <Tabs.Screen name="tutorial-videos" options={{ href: null }} />
      <Tabs.Screen name="tutorial-video-player" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="my-workout-plans" options={{ href: null }} />
      <Tabs.Screen name="my-meal-plans" options={{ href: null }} />
    </Tabs>
  );
}
