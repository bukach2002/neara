import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { initials, titleCase, type BadgeTone } from '@/lib/format';
import type { BookingRecord } from '@/types';

const TONE_STYLES: Record<BadgeTone, { background: string; text: string; dot: string }> = {
  neutral: { background: colors.soft, text: colors.muted, dot: colors.lineStrong },
  accent: { background: colors.accentSoft, text: colors.accentStrong, dot: colors.accent },
  teal: { background: colors.tealSoft, text: '#0b6c63', dot: colors.teal },
  success: { background: colors.successSoft, text: colors.success, dot: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning, dot: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger, dot: colors.danger },
  violet: { background: colors.violetSoft, text: colors.violet, dot: colors.violet },
};

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: palette.dot }]} /> : null}
      <Text style={[styles.badgeLabel, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2.6 },
      ]}
    >
      <Text style={[styles.avatarLabel, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

export function BrandMark({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Text style={styles.brandLetter}>N</Text>
      </View>
      {wordmark ? <Text style={styles.brandWord}>neara</Text> : null}
    </View>
  );
}

export function Note({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'error' | 'success' | 'warning';
}) {
  const palette =
    tone === 'error'
      ? { background: colors.dangerSoft, border: '#f1beb9', text: colors.danger, icon: 'alert-circle-outline' as const }
      : tone === 'success'
        ? { background: colors.successSoft, border: '#bfe8d2', text: colors.success, icon: 'checkmark-circle-outline' as const }
        : tone === 'warning'
          ? { background: colors.warningSoft, border: '#f2dfa8', text: colors.warning, icon: 'information-circle-outline' as const }
          : { background: colors.soft, border: colors.line, text: colors.ink, icon: 'information-circle-outline' as const };

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.note, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <Ionicons name={palette.icon} size={17} color={palette.text} />
      <Text style={[styles.noteText, { color: palette.text }]}>{children}</Text>
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  icon,
  badge,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: ReactNode;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function KeyValue({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function BookingReceipt({
  booking,
  footer,
  compact = false,
}: {
  booking: BookingRecord;
  footer?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={styles.receipt}>
      <View style={styles.receiptHead}>
        <View style={styles.flex}>
          <Text style={styles.receiptEyebrow}>Booking reference</Text>
          <Text style={styles.receiptReference} selectable>
            {booking.bookingReference}
          </Text>
        </View>
        <Badge label={titleCase(booking.status)} tone={booking.status === 'confirmed' ? 'teal' : 'neutral'} dot />
      </View>

      <View style={styles.receiptRows}>
        <KeyValue label="Studio" value={booking.tenantNameSnapshot} />
        <KeyValue label="Service" value={booking.serviceNameSnapshot} />
        <KeyValue label="Expert" value={booking.expertDisplayNameSnapshot} />
        <KeyValue label="When" value={booking.displayTimeSnapshot} />
        <KeyValue
          label="Where"
          value={
            compact
              ? booking.locationNameSnapshot
              : `${booking.locationNameSnapshot} · ${booking.locationAddressSnapshot}`
          }
        />
        {booking.customerNote ? <KeyValue label="Your note" value={booking.customerNote} /> : null}
      </View>

      {footer ? <View style={styles.receiptFooter}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { ...typography.smallStrong, fontSize: 12, lineHeight: 16 },
  avatar: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfe0f7',
  },
  avatarLabel: { color: colors.accentStrong, fontWeight: '700' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: { color: '#ffffff', fontSize: 19, fontWeight: '700' },
  brandWord: { ...typography.title, color: colors.ink },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noteText: { ...typography.small, flex: 1 },
  stat: {
    flex: 1,
    minWidth: 120,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.ink },
  statLabel: { ...typography.small, color: colors.muted },
  statHint: { ...typography.small, color: colors.muted, fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: { ...typography.bodyStrong, color: colors.ink, flexShrink: 1 },
  rowSubtitle: { ...typography.small, color: colors.muted },
  rowMeta: { ...typography.small, color: colors.muted, fontSize: 12 },
  keyValue: { gap: 1, paddingVertical: 5 },
  keyValueLabel: { ...typography.eyebrow, color: colors.muted, textTransform: 'uppercase' },
  keyValueValue: { ...typography.body, color: colors.ink },
  receipt: { gap: spacing.md },
  receiptHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  receiptEyebrow: { ...typography.eyebrow, color: colors.muted, textTransform: 'uppercase' },
  receiptReference: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.ink, letterSpacing: 1.5 },
  receiptRows: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    gap: 2,
  },
  receiptFooter: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, gap: spacing.sm },
});
