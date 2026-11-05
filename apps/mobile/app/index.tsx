import { Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { BootScreen, Screen } from '@/components/layout';
import { Button } from '@/components/controls';
import { colors, spacing, typography } from '@/theme';

export default function Index() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <BootScreen />;
  }

  if (auth.status === 'error') {
    return (
      <Screen>
        <View style={styles.error}>
          <Text style={styles.errorTitle}>We could not check your session</Text>
          <Text style={styles.errorBody}>{auth.bootError}</Text>
          <Button label="Try again" onPress={auth.retryBootstrap} />
          <Button label="Sign in instead" variant="secondary" onPress={() => void auth.signOut()} />
        </View>
      </Screen>
    );
  }

  if (auth.status === 'anonymous' || !auth.role) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href={auth.goHome(auth.role)} />;
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: { ...typography.title, color: colors.ink, textAlign: 'center' },
  errorBody: { ...typography.body, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
});
