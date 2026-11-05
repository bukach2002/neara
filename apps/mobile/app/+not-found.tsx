import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/controls';
import { Screen } from '@/components/layout';
import { colors, spacing, typography } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <View style={styles.body}>
          <Text style={styles.title}>That screen does not exist</Text>
          <Text style={styles.subtitle}>The link may be out of date.</Text>
          <Button label="Go to Neara" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
});
