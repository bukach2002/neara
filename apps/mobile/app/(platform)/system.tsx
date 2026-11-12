import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  createCategory,
  listAuditLogs,
  listCategories,
  listNotificationLogs,
  updateCategory,
} from '@/api/platform';
import { useAuth } from '@/auth/AuthProvider';
import { Button, SegmentedControl, SwitchRow, TextField } from '@/components/controls';
import { Badge, BrandMark, ListRow, Note } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
  SectionCard,
  SectionTitle,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { formatLogTimestamp, titleCase, type BadgeTone } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';

type Tab = 'categories' | 'audit' | 'notifications';

function notificationTone(status: string): BadgeTone {
  switch (status) {
    case 'sent':
    case 'delivered':
      return 'success';
    case 'failed':
      return 'danger';
    case 'queued':
    case 'retrying':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function PlatformSystemScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('categories');
  const [busyCategory, setBusyCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const categories = useAsync(() => listCategories(), []);
  const audit = useAsync(() => listAuditLogs({ take: 30 }), []);
  const notifications = useAsync(() => listNotificationLogs({ take: 30 }), []);

  async function toggleCategory(id: string, isActive: boolean) {
    setBusyCategory(id);
    setCategoryError(null);
    try {
      await updateCategory(id, { isActive });
      categories.refresh();
    } catch (caught) {
      setCategoryError(messageFor(caught, 'Could not update the category.'));
    } finally {
      setBusyCategory(null);
    }
  }

  async function submitCategory() {
    setCategoryError(null);
    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanName.length < 2) {
      setCategoryError('Give the category a name of at least 2 characters.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setCategoryError('The slug must use lowercase letters, numbers, and single hyphens.');
      return;
    }

    setCreating(true);
    try {
      await createCategory({ name: cleanName, slug: cleanSlug });
      setName('');
      setSlug('');
      categories.refresh();
    } catch (caught) {
      setCategoryError(messageFor(caught, 'Could not create the category.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              if (tab === 'categories') categories.refresh();
              if (tab === 'audit') audit.refresh();
              if (tab === 'notifications') notifications.refresh();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.brandRow}>
          <BrandMark />
          <Badge label="Platform admin" tone="violet" dot />
        </View>

        <ScreenHeader
          eyebrow="System"
          title="Operations"
          subtitle="Category catalogue, audit trail, and notification delivery."
        />

        <SegmentedControl
          options={[
            { label: 'Categories', value: 'categories' },
            { label: 'Audit', value: 'audit' },
            { label: 'Email', value: 'notifications' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'categories' ? (
          <>
            <SectionCard title="New category" subtitle="Categories group studios in discovery.">
              <TextField
                label="Name"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setSlug(
                    value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                      .slice(0, 60),
                  );
                }}
                placeholder="Wellness"
                autoCapitalize="words"
              />
              <TextField
                label="Slug"
                value={slug}
                onChangeText={setSlug}
                placeholder="wellness"
                hint="Lowercase letters, numbers, and single hyphens."
              />
              <Button
                label="Create category"
                icon="add-circle-outline"
                onPress={submitCategory}
                loading={creating}
              />
              {categoryError ? <Note tone="error">{categoryError}</Note> : null}
            </SectionCard>

            {categories.loading && !categories.data ? <LoadingBlock label="Loading categories…" /> : null}
            {categories.error ? <ErrorBlock message={categories.error} onRetry={categories.refresh} /> : null}

            <SectionTitle>Catalogue</SectionTitle>
            <View style={styles.list}>
              {(categories.data ?? []).map((category) => (
                <Card key={category.id} style={styles.categoryCard}>
                  <View style={styles.categoryHead}>
                    <View style={styles.flex}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryMeta}>
                        {category.slug} · {category._count?.tenants ?? 0} tenant
                        {(category._count?.tenants ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Badge
                      label={category.isActive ? 'Active' : 'Hidden'}
                      tone={category.isActive ? 'success' : 'neutral'}
                      dot
                    />
                  </View>
                  <SwitchRow
                    title="Visible to customers"
                    subtitle="Hidden categories keep their tenants but stop new grouping"
                    value={Boolean(category.isActive)}
                    disabled={busyCategory !== null}
                    onValueChange={(value) => void toggleCategory(category.id, value)}
                  />
                </Card>
              ))}
              {categories.data && categories.data.length === 0 ? (
                <Card>
                  <EmptyState icon="pricetags-outline" title="No categories yet" body="Create one above." />
                </Card>
              ) : null}
            </View>
          </>
        ) : null}

        {tab === 'audit' ? (
          <>
            {audit.loading && !audit.data ? <LoadingBlock label="Loading audit trail…" /> : null}
            {audit.error ? <ErrorBlock message={audit.error} onRetry={audit.refresh} /> : null}
            <View style={styles.list}>
              {(audit.data?.items ?? []).map((entry) => (
                <Card key={entry.id} padded={false} style={styles.logCard}>
                  <ListRow
                    icon="document-text-outline"
                    title={entry.summary}
                    subtitle={`${entry.action}${entry.actor ? ` · ${entry.actor.name}` : ' · system'}`}
                    meta={`${entry.tenant?.name ?? 'Platform'} · ${formatLogTimestamp(entry.createdAt)}`}
                  />
                </Card>
              ))}
              {audit.data && audit.data.items.length === 0 ? (
                <Card>
                  <EmptyState icon="document-text-outline" title="No audit entries" body="Critical actions appear here." />
                </Card>
              ) : null}
            </View>
          </>
        ) : null}

        {tab === 'notifications' ? (
          <>
            <Note tone="neutral">
              Email delivery is asynchronous. Failed messages stay here with their last error so support
              can investigate.
            </Note>
            {notifications.loading && !notifications.data ? (
              <LoadingBlock label="Loading delivery log…" />
            ) : null}
            {notifications.error ? (
              <ErrorBlock message={notifications.error} onRetry={notifications.refresh} />
            ) : null}
            <View style={styles.list}>
              {(notifications.data?.items ?? []).map((entry) => (
                <Card key={entry.id} padded={false} style={styles.logCard}>
                  <ListRow
                    icon="mail-outline"
                    title={entry.templateKey}
                    subtitle={entry.recipientEmail ?? entry.tenant?.name ?? 'No recipient'}
                    meta={`${titleCase(entry.status)} · ${formatLogTimestamp(entry.createdAt)}${
                      entry.errorMessage ? ` · ${entry.errorMessage}` : ''
                    }`}
                    badge={<Badge label={titleCase(entry.status)} tone={notificationTone(entry.status)} dot />}
                  />
                </Card>
              ))}
              {notifications.data && notifications.data.items.length === 0 ? (
                <Card>
                  <EmptyState icon="mail-outline" title="No email activity yet" />
                </Card>
              ) : null}
            </View>
          </>
        ) : null}

        <SectionCard title="Signed in" subtitle={auth.user?.email ?? auth.user?.name}>
          <ListRow
            icon="phone-portrait-outline"
            title="Devices and sessions"
            subtitle="Review and revoke signed-in browsers and phones"
            onPress={() => router.push('/sessions')}
          />
          <View style={styles.sessionRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
            <Text style={styles.sessionText}>
              This device holds short-lived bearer tokens in the OS keystore. Signing out revokes
              them on the server and erases local material.
            </Text>
          </View>
          <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => void auth.signOut()} />
        </SectionCard>

        <Text style={styles.footnote}>
          Tenant creation, first-admin provisioning, PII anonymization, and queue inspection remain in
          the web console.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  list: { gap: spacing.sm },
  categoryCard: { gap: spacing.xs },
  categoryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  categoryName: { ...typography.bodyStrong, color: colors.ink },
  categoryMeta: { ...typography.small, color: colors.muted },
  logCard: { paddingHorizontal: spacing.lg },
  sessionRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  sessionText: { ...typography.small, color: colors.muted, flex: 1 },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
