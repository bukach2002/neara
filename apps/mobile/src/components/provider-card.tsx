import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { formatMoney, pluralize } from '@/lib/format';
import type { SearchTenant } from '@/types';
import { Avatar, Badge } from './display';

export function ProviderCard({ tenant, onPress }: { tenant: SearchTenant; onPress: () => void }) {
  const serviceNames = tenant.services.slice(0, 3).map((service) => service.name);
  const firstService = tenant.services[0];
  const price = firstService
    ? formatMoney(firstService.displayPriceAmount, firstService.displayPriceCurrency)
    : null;
  const hasSlots = tenant.availabilityState === 'availability_configured';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${tenant.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.head}>
        <Avatar name={tenant.name} size={46} />
        <View style={styles.headBody}>
          <Text style={styles.name} numberOfLines={1}>
            {tenant.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {tenant.category?.name ?? 'Studio'}
            {tenant.location ? ` · ${tenant.location.locality}` : ''}
          </Text>
        </View>
        {tenant.distanceKm !== null ? (
          <Text style={styles.distance}>{tenant.distanceKm.toFixed(1)} km</Text>
        ) : null}
      </View>

      {tenant.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {tenant.description}
        </Text>
      ) : null}

      {serviceNames.length > 0 ? (
        <View style={styles.services}>
          {serviceNames.map((name) => (
            <View key={name} style={styles.serviceChip}>
              <Text style={styles.serviceText}>{name}</Text>
            </View>
          ))}
          {tenant.services.length > serviceNames.length ? (
            <Text style={styles.more}>+{tenant.services.length - serviceNames.length}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Badge
          label={hasSlots ? 'Booking enabled' : 'No slots currently'}
          tone={hasSlots ? 'teal' : 'neutral'}
          dot
        />
        <View style={styles.footerRight}>
          {price ? <Text style={styles.price}>from {price}</Text> : null}
          {firstService ? (
            <Text style={styles.duration}>{pluralize(firstService.durationMinutes, 'min')}</Text>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: 2 },
  name: { ...typography.subtitle, color: colors.ink },
  meta: { ...typography.small, color: colors.muted },
  distance: { ...typography.smallStrong, color: colors.teal },
  description: { ...typography.small, color: colors.muted },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  serviceChip: {
    backgroundColor: colors.soft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceText: { ...typography.small, color: colors.ink, fontSize: 12 },
  more: { ...typography.small, color: colors.muted, fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  price: { ...typography.smallStrong, color: colors.ink },
  duration: { ...typography.small, color: colors.muted },
});
