import { Stack } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/**
 * Detail screens are Stack routes, not hidden tabs. A hidden tab is redirected
 * back to the initial tab by expo-router when it receives focus.
 */
export default function PlatformLayout() {
  return (
    <RoleGate role="platform_admin">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tenants/[id]" />
        <Stack.Screen name="bookings/[id]" />
      </Stack>
    </RoleGate>
  );
}
