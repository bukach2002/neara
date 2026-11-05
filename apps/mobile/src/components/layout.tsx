import { Ionicons } from '@expo/vector-icons';
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { Button } from './controls';

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
}: {
  children: ReactNode;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenScroll({
  children,
  refreshControl,
  contentStyle,
  horizontalPadding = true,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  horizontalPadding?: boolean;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        horizontalPadding ? styles.scrollPadding : null,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded ? styles.cardPadded : null, style]}>{children}</View>;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={style}>
      {title ? (
        <View style={styles.sectionHead}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.groupTitle}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={styles.errorCard}>
      <View style={styles.errorHead}>
        <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
        <Text style={styles.errorTitle}>Something needs attention</Text>
      </View>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function BootScreen() {
  return (
    <SafeAreaView style={[styles.screen, styles.boot]}>
      <View style={styles.bootMark}>
        <Text style={styles.bootLetter}>N</Text>
      </View>
      <Text style={styles.bootWord}>neara</Text>
      <ActivityIndicator color={colors.accent} style={styles.bootSpinner} />
      <Text style={styles.bootLabel}>Securing your session…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: 60, gap: spacing.lg },
  scrollPadding: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: { ...typography.display, color: colors.ink },
  subtitle: { ...typography.body, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  cardPadded: { padding: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.subtitle, color: colors.ink },
  sectionSubtitle: { ...typography.small, color: colors.muted, marginTop: 2 },
  groupTitle: {
    ...typography.eyebrow,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.subtitle, color: colors.ink, textAlign: 'center' },
  emptyBody: { ...typography.small, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loadingLabel: { ...typography.small, color: colors.muted },
  errorCard: { borderColor: '#f3c6c2', backgroundColor: '#fffaf9', gap: spacing.md },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorTitle: { ...typography.bodyStrong, color: colors.danger },
  errorBody: { ...typography.small, color: colors.ink },
  boot: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  bootMark: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootLetter: { color: colors.surface, fontSize: 26, fontWeight: '700' },
  bootWord: { ...typography.title, color: colors.ink },
  bootSpinner: { marginTop: spacing.lg },
  bootLabel: { ...typography.small, color: colors.muted },
});
