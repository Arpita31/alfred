import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { C } from '../theme';

import DashboardScreen  from '../screens/DashboardScreen';
import HydrationScreen  from '../screens/HydrationScreen';
import NutritionScreen  from '../screens/NutritionScreen';
import SleepScreen      from '../screens/SleepScreen';
import ActivityScreen   from '../screens/ActivityScreen';
import FinanceScreen    from '../screens/FinanceScreen';
import AIScreen         from '../screens/AIScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Dashboard',  icon: '⊟',  component: DashboardScreen  },
  { name: 'Hydration',  icon: '💧', component: HydrationScreen  },
  { name: 'Nutrition',  icon: '🍽',  component: NutritionScreen  },
  { name: 'Sleep',      icon: '🌙', component: SleepScreen      },
  { name: 'Activity',   icon: '⚡',  component: ActivityScreen   },
  { name: 'Finance',    icon: '◈',  component: FinanceScreen    },
  { name: 'AI',         icon: '✦',  component: AIScreen         },
];

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const tab = TABS.find(t => t.name === route.name);
          return (
            <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{tab?.icon ?? '●'}</Text>
          );
        },
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.surface1,
          borderTopColor: C.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerStyle: { backgroundColor: C.surface1, shadowColor: 'transparent', elevation: 0, borderBottomWidth: 1, borderBottomColor: C.border },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '700', color: C.text, fontSize: 16 },
        headerTitle: route.name === 'AI' ? 'Alfred AI' : route.name,
      })}
    >
      {TABS.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}
