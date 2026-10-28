import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { isSafeHttpUrl } from '../../utils/links';
import { useAuthStore } from '../../auth/authStore';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useExamSchedule } from '../../hooks/useExamSchedule';
import { MenuTile } from '../../menu/types';
import { dateWithWeekday, localDateKey } from '../../utils/dates';
import { safeAttachmentUrl } from './circularModel';
import { examItems, ExamItem, splitExams } from './examScheduleModel';
import { StaleBanner, studentGate } from './gate';

/**
 * The student's published exam schedules: Upcoming (soonest first, today included), Earlier (most recent
 * first), and "Date to be confirmed" for rows whose date cannot be read - nothing is dropped. The file
 * link opens only after the host check (re-based onto the API host, anything unknown refused). Read-only.
 */
export function ExamScheduleScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useExamSchedule();
  const today = useMemo(() => localDateKey(new Date()), []);
  const items = useMemo(() => examItems(q.data ?? []), [q.data]);
  const groups = useMemo(() => splitExams(items, today), [items, today]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {items.length === 0 ? (
        <EmptyState title="No exams scheduled" hint="Exam schedules for your class will appear here once your school publishes them." />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Section title="Upcoming" items={groups.upcoming} empty="No upcoming exams." />
          {groups.earlier.length > 0 ? <Section title="Earlier" items={groups.earlier} /> : null}
          {groups.unknown.length > 0 ? <Section title="Date to be confirmed" items={groups.unknown} /> : null}
        </View>
      )}
    </Page>
  );
}

function Section({ title, items, empty }: { title: string; items: ExamItem[]; empty?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.heading} accessibilityRole="header">
        {title}
      </Text>
      {items.length === 0 ? <Text style={styles.muted}>{empty}</Text> : items.map((e, i) => <ExamCard key={`${e.dateKey}-${e.title}-${i}`} item={e} />)}
    </View>
  );
}

function ExamCard({ item }: { item: ExamItem }) {
  const when = item.dateKey ? dateWithWeekday(item.dateKey) : 'Date to be confirmed';
  const title = item.title || 'Untitled exam';
  const file = safeAttachmentUrl(item.file);
  return (
    <Card>
      <View accessible accessibilityLabel={`${title}, ${when}`}>
        <Text style={styles.date}>{when}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {file ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Open schedule" variant="secondary" onPress={() => { if (isSafeHttpUrl(file)) void Linking.openURL(file).catch(() => {}); }} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  muted: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular },
  date: { color: colors.primary, fontSize: 13, fontFamily: fonts.semibold },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginTop: 2 },
});
