import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { StatusPill } from '../../components/StatusPill';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useLeaveApplications } from '../../hooks/useLeaveApplications';
import { MenuTile } from '../../menu/types';
import { StaleBanner, studentGate } from './gate';
import { LeaveRow, leaveRows } from './leaveModel';
import { LIST_PAGE_SIZE } from './listHelpers';

const NOT_AVAILABLE = "Apply for leave — This isn't available in the app yet.";

/**
 * The student's own leave applications (`studentLeaveApplicationAPI`), newest first, with status and the staff reply.
 * VIEW ONLY: no form, no submit, no file picker. An attachment opens only in the phone's browser / viewer after the
 * F1 host check; the app never downloads, caches or shares it. The tile's stored `api` is ignored.
 */
export function LeaveApplicationsScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useLeaveApplications();
  const rows = useMemo(() => leaveRows(q.data ?? []), [q.data]);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);
  const [failed, setFailed] = useState<string | null>(null);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const open = (row: LeaveRow) => {
    if (!row.fileUrl) return;
    setFailed(null);
    void Promise.resolve()
      .then(() => Linking.openURL(row.fileUrl as string))
      .catch(() => setFailed(row.key));
  };

  const visible = rows.slice(0, shown);

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState title={`No leave requests for school year ${user?.syear}`} hint={NOT_AVAILABLE} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear}</Text>
          {visible.map((row) => (
            <Card key={row.key}>
              <View
                accessible
                accessibilityLabel={`${row.title}${row.range ? `, ${row.range}` : ''}, ${row.statusLabel}${row.hasReply ? `. Reply${row.replyBy ? ` from ${row.replyBy}` : ''}.` : ''}`}
                style={{ gap: spacing.xs }}
              >
                <Text style={styles.title}>{row.title}</Text>
                <StatusPill label={row.statusLabel} tone={row.statusTone} />
                {row.range ? <Text style={styles.range}>{row.range}</Text> : null}
                {row.appliedOn ? <Text style={styles.muted}>Applied {row.appliedOn}</Text> : null}
                {row.message ? <Text style={styles.body}>{row.message}</Text> : null}
                {row.fileState === 'unsafe' ? <Text style={styles.warn}>Attachment can't be opened from the app</Text> : null}
                {row.hasReply ? (
                  <View style={styles.reply}>
                    <Text style={styles.replyHead}>
                      Reply{row.replyBy ? ` from ${row.replyBy}` : ''}
                      {row.replyOn ? ` · ${row.replyOn}` : ''}
                    </Text>
                    <Text style={styles.body}>{row.reply}</Text>
                  </View>
                ) : null}
              </View>
              {row.fileState === 'ready' ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Button title="Open attachment" variant="secondary" onPress={() => open(row)} />
                </View>
              ) : null}
              {failed === row.key ? (
                <Text style={styles.warn} accessibilityRole="alert">
                  Couldn't open the file. Please try again or contact your school.
                </Text>
              ) : null}
            </Card>
          ))}
          {rows.length > visible.length ? (
            <Button title={`Show more (${rows.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
          <Text style={styles.muted}>{NOT_AVAILABLE}</Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  range: { color: colors.primary, fontSize: 14, fontFamily: fonts.semibold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular },
  warn: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
  reply: { marginTop: spacing.xs, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.primarySoft, gap: 2 },
  replyHead: { color: colors.primary, fontSize: 12, fontFamily: fonts.semibold },
});
