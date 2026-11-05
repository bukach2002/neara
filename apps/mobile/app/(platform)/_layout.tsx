import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors, typography } from '@/theme';

export default function PlatformLayout() {
  return (
    <RoleGate role="platform_admin">
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
            title: 'Tenants',
            tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
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
          name="system"
          options={{
            title: 'System',
            tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={typeof color === 'string' ? color : colors.muted} />,
          }}
        />
        <Tabs.Screen name="tenants/[id]" options={{ href: null }} />
        <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
