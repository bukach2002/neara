import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { getCategories, searchTenants } from '@/api/public';
import { Chip, HorizontalChips, SearchField, TextField } from '@/components/controls';
import { BrandMark, Note } from '@/components/display';
import { EmptyState, ErrorBlock, LoadingBlock, Screen, ScreenHeader, ScreenScroll, SectionTitle } from '@/components/layout';
import { ProviderCard } from '@/components/provider-card';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';

export default function DiscoverScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [locality, setLocality] = useState('');
  const [debouncedLocality, setDebouncedLocality] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setDebouncedLocality(locality.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [keyword, locality]);

  const categories = useAsync(() => getCategories(), []);
  const results = useAsync(
    () => searchTenants({ keyword: debouncedKeyword, category, locality: debouncedLocality }),
    [debouncedKeyword, debouncedLocality, category],
  );

  const firstName = useMemo(() => (auth.user?.name ?? '').trim().split(/\s+/)[0] ?? '', [auth.user?.name]);
  const tenants = results.data?.items ?? [];
  const filtersActive = Boolean(debouncedKeyword || category || debouncedLocality);
  const refreshing = results.loading && results.data !== null;

  function refreshAll() {
    categories.refresh();
    results.refresh();
  }

  return (
    <Screen>
      <ScreenScroll
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.brandRow}>
          <BrandMark />
        </View>

        <ScreenHeader
          eyebrow="Discover"
          title={firstName ? `Hello, ${firstName}` : 'Find your next studio'}
          subtitle="Search trusted studios, pick a service, and lock a confirmed slot in seconds."
        />

        <View style={styles.filters}>
          <SearchField
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Search studios, services, or experts"
            onSubmitEditing={() => setDebouncedKeyword(keyword.trim())}
          />

          {categories.data && categories.data.length > 0 ? (
            <HorizontalChips>
              <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
              {categories.data.map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  selected={category === item.slug}
                  onPress={() => setCategory(category === item.slug ? undefined : item.slug)}
                />
              ))}
            </HorizontalChips>
          ) : null}

          <TextField
            value={locality}
            onChangeText={setLocality}
            placeholder="Filter by locality, e.g. Koregaon Park"
            autoCapitalize="words"
          />
        </View>

        {categories.error ? <Note tone="error">{categories.error}</Note> : null}

        <View style={styles.resultsHead}>
          <SectionTitle>
            {filtersActive ? 'Matching studios' : 'Studios on Neara'}
          </SectionTitle>
          {results.data ? (
            <Text style={styles.count}>
              {tenants.length} {tenants.length === 1 ? 'result' : 'results'}
            </Text>
          ) : null}
        </View>

        {results.loading && !results.data ? <LoadingBlock label="Finding studios…" /> : null}
        {results.error && !results.data ? <ErrorBlock message={results.error} onRetry={results.refresh} /> : null}
        {results.error && results.data ? <Note tone="error">{results.error}</Note> : null}

        {!results.loading && !results.error && tenants.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No studios match those filters"
            body="Try a different service, category, or locality. New studios appear as they activate."
          />
        ) : null}

        <View style={styles.list}>
          {tenants.map((tenant) => (
            <ProviderCard
              key={tenant.id}
              tenant={tenant}
              onPress={() =>
                router.push({ pathname: '/(customer)/tenant/[slug]', params: { slug: tenant.slug } })
              }
            />
          ))}
        </View>

        <Text style={styles.footnote}>
          Neara shows only active, verified studios. Bookings are confirmed instantly and no payment
          details are collected.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { paddingTop: spacing.sm },
  filters: { gap: spacing.md },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  count: { ...typography.small, color: colors.muted },
  list: { gap: spacing.md },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
