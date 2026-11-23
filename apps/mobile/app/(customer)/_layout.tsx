import { Stack } from 'expo-router';
import { RoleGate } from '@/auth/guards';
import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/**
 * A Stack hosts the tabs plus full-screen detail routes. Detail screens must not
 * be declared as hidden tabs: expo-router redirects a focused hidden tab back to
 * the initial tab, which made the studio page unreachable.
 */
export default function CustomerLayout() {
  return (
    <RoleGate role="customer">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tenant/[slug]" />
      </Stack>
    </RoleGate>
  );
}
