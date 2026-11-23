import { Stack } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/**
 * Detail and setup screens are Stack routes, not hidden tabs. A hidden tab is
 * redirected back to the initial tab by expo-router when it receives focus.
 */
export default function TenantLayout() {
  return (
    <RoleGate role="tenant_admin">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="bookings/[id]" />
        <Stack.Screen name="setup" />
      </Stack>
    </RoleGate>
  );
}
