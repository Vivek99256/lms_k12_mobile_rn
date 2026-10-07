import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isApiError, userMessage } from '../../api/errors';
import { useAuthStore } from '../../auth/authStore';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../config/theme';
import { useFeeSummary } from '../../hooks/useFeeSummary';
import { MenuTile } from '../../menu/types';
import { formatInr } from '../../utils/money';
import { feeView } from './feesModel';
import { StaleBanner, studentGate } from './gate';

const SERVER_PROBLEM = "The fees summary could not be loaded right now. If this keeps happening, please contact your school's accounts office.";

/** A server-side failure gets fee-specific wording that does not claim a cause; everything else keeps the shared message. */
const feesErrorMessage = (e: unknown) => (isApiError(e) && e.kind === 'server' && (e.status ?? 0) >= 500 ? SERVER_PROBLEM : userMessage(e));

/**
 * The student's whole-year fee totals: total, paid and pending. VIEW ONLY - no payment, receipt or link
 * of any kind (S6 doc §0). The three figures come from `fees/PaidUnpaid` exactly as sent.
 */
export function FeesSummaryScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useFeeSummary();
  const view = useMemo(() => (q.data ? feeView(q.data) : null), [q.data]);

  const blocked = studentGate(user, q, feesErrorMessage);
  if (blocked) return blocked;

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {!view ? (
        <EmptyState
          title={`No fee details for school year ${user?.syear} yet`}
          hint="Your school has not published fee details for this year. Please contact your school's accounts office if you expected them."
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear} · whole-year totals</Text>
          <View accessible accessibilityLabel={view.spoken} style={{ gap: spacing.md }}>
            <Card>
              <Text style={styles.label}>{view.settled ? 'Pending fees' : 'Pending fees (whole-year balance)'}</Text>
              <Text style={[styles.big, { color: view.settled ? colors.success : colors.text }]}>{view.settled ? 'No pending fees' : formatInr(view.pending)}</Text>
              {view.percent !== null ? (
                <View style={{ marginTop: spacing.sm }}>
                  <View style={styles.track} importantForAccessibility="no-hide-descendants">
                    <View style={[styles.fill, { width: `${view.percent}%` }]} />
                  </View>
                  <Text style={styles.muted}>
                    Paid {view.percent}% of {formatInr(view.total)}
                  </Text>
                </View>
              ) : null}
              {view.advance > 0 ? <Text style={styles.advance}>Paid in advance {formatInr(view.advance)}</Text> : null}
            </Card>
            <Card>
              <Row label="Total fees for the year" value={formatInr(view.total)} />
              <Row label="Paid (includes any discounts)" value={formatInr(view.paid)} />
              <Row label="Pending" value={formatInr(view.pending)} last />
            </Card>
          </View>
          <Text style={styles.muted}>
            These are whole-year totals as last loaded; they are not guaranteed to be real-time. Month-wise dues, receipts and online payment are not in the app yet.
          </Text>
        </View>
      )}
    </Page>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? null : styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  label: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.semibold },
  big: { fontSize: 30, fontFamily: fonts.bold, marginTop: 2 },
  track: { height: 10, borderRadius: radius.sm, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.success },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  advance: { color: colors.success, fontSize: 14, fontFamily: fonts.semibold, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.regular },
  rowValue: { color: colors.text, fontSize: 15, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'right' },
});
