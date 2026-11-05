import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors, typography } from '@/theme';

export default function CustomerLayout() {
  return (
    <RoleGate role="customer">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { ...typography.small, fontSize: 11, fontWeight: '600' },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen
          name="appointments"
          options={{
            title: 'Appointments',
            tabBarIcon: ({ color, size }) => <Ionicons name="ticket-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen name="tenant/[slug]" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
