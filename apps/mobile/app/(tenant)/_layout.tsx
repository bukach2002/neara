import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors, typography } from '@/theme';

export default function TenantLayout() {
  return (
    <RoleGate role="tenant_admin">
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
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Bookings',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen
          name="studio"
          options={{
            title: 'Studio',
            tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
        <Tabs.Screen name="setup" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
