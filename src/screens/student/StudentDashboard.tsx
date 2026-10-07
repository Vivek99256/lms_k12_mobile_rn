import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { userMessage } from '../../api/errors';
import { PendingItem } from '../../api/student';
import { useAuthStore } from '../../auth/authStore';
import { Skeleton } from '../../components/motion';
import { Button, Card } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../config/theme';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';
import { useOpenScreen } from '../../navigation/useOpenScreen';
import { displayDate, localDateKey } from '../../utils/dates';
import { cappedCount, classLabel, dueLabel, isOverdue, pendingTitle, Progress, subjectName, taskProgress } from './dashboardModel';

/**
 * The student's "day at a glance" on Home, from `student-dashboard/summary`. It never blocks the menu below
 * it: every problem is shown as a compact card, not a full-screen state. Rendered for student sessions only.
 */
export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const q = useStudentDashboard();
  const { canOpen, open } = useOpenScreen();
  const today = useMemo(() => localDateKey(new Date()), []);

  if (!user?.isStudent) return null;
  if (!user.syear?.trim()) return <Notice text="School year not set. Please contact your school." />;
  if (q.isLoading) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Heading />
        <Skeleton height={64} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton style={{ flex: 1 }} height={80} />
          <Skeleton style={{ flex: 1 }} height={80} />
          <Skeleton style={{ flex: 1 }} height={80} />
        </View>
      </View>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Heading />
        <Notice text={`Dashboard unavailable: ${userMessage(q.error)}`} />
        <Button title="Try again" variant="secondary" onPress={() => void q.refetch()} />
      </View>
    );
  }

  const progress = taskProgress(d.tasks);
  const homeworkTile = canOpen('home_work');
  const circularTile = canOpen('circular_events');

  return (
    <View style={{ gap: spacing.md }}>
      <Heading />
      {q.isError ? <Notice text="Couldn't refresh — showing the last loaded data." /> : null}

      <Card>
        {d.enrollment ? (
          <View accessible accessibilityLabel={`Class ${classLabel(d.enrollment)}, school year ${d.enrollment.syear}`}>
            <Text style={styles.overline}>Your class</Text>
            <Text style={styles.big}>{classLabel(d.enrollment) || '—'}</Text>
            {d.enrollment.syear ? <Text style={styles.muted}>School year {d.enrollment.syear}</Text> : null}
          </View>
        ) : (
          <View accessible accessibilityLabel="No class found for this school year">
            <Text style={styles.overline}>Your class</Text>
            <Text style={styles.muted}>No class found for this school year.</Text>
          </View>
        )}
      </Card>

      <View style={styles.stats}>
        <Stat label="Subjects" value={String(d.summary.totalSubjects)} />
        <Stat label="Pending homework" value={cappedCount(d.summary.pendingHomework)} />
        <Stat label="Pending assignments" value={cappedCount(d.summary.pendingAssignments)} />
      </View>

      {progress.homework || progress.assignments ? (
        <Card>
          <Text style={styles.heading}>Task progress</Text>
          <ProgressRow label="Homework" p={progress.homework} />
          <ProgressRow label="Assignments" p={progress.assignments} />
        </Card>
      ) : null}

      <ListCard
        title="Pending homework"
        empty="No pending homework."
        items={d.pendingHomework}
        subjects={d.subjects}
        today={today}
        onViewAll={homeworkTile ? () => open('home_work') : undefined}
      />
      <ListCard title="Pending assignments" empty="No pending assignments." items={d.pendingAssignments} subjects={d.subjects} today={today} />

      <Card>
        <View style={styles.titleRow}>
          <Text style={styles.heading}>Recent circulars</Text>
          {circularTile ? <ViewAll label="Recent circulars" onPress={() => open('circular_events')} /> : null}
        </View>
        {d.circulars.length === 0 ? (
          <Text style={styles.muted}>No recent circulars.</Text>
        ) : (
          d.circulars.map((c, i) => (
            <View key={`${c.id}-${i}`} style={styles.row} accessible accessibilityLabel={`${c.title || 'Untitled'}, ${displayDate(c.date)}`}>
              <Text style={styles.rowTitle}>{c.title || 'Untitled'}</Text>
              <Text style={styles.muted}>{displayDate(c.date)}</Text>
            </View>
          ))
        )}
      </Card>

      {d.subjects.length > 0 ? (
        <Card>
          <Text style={styles.heading}>My subjects</Text>
          <View style={styles.chips}>
            {d.subjects.map((s, i) => (
              <View key={`${s.id}-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>{s.name || 'Subject'}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const Heading = () => <Text style={styles.sectionTitle}>Your day at a glance</Text>;

function Notice({ text }: { text: string }) {
  return (
    <Card>
      <Text style={styles.muted} accessibilityRole="alert">
        {text}
      </Text>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressRow({ label, p }: { label: string; p: Progress | null }) {
  if (!p) return null;
  const text = `${p.done} done · ${cappedCount(p.pending)} pending`;
  return (
    <View style={{ marginTop: spacing.sm }} accessible accessibilityLabel={`${label}: ${text}`}>
      <View style={styles.titleRow}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.muted}>{text}</Text>
      </View>
      {p.ratio !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(p.ratio * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

function ViewAll({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View all ${label.toLowerCase()}`} onPress={onPress} hitSlop={8} style={styles.viewAll}>
      <Text style={styles.viewAllText}>View all</Text>
    </Pressable>
  );
}

function ListCard({
  title,
  empty,
  items,
  subjects,
  today,
  onViewAll,
}: {
  title: string;
  empty: string;
  items: PendingItem[];
  subjects: { id: string; name: string }[];
  today: string;
  onViewAll?: () => void;
}) {
  return (
    <Card>
      <View style={styles.titleRow}>
        <Text style={styles.heading}>{title}</Text>
        {onViewAll ? <ViewAll label={title} onPress={onViewAll} /> : null}
      </View>
      {items.length === 0 ? (
        <Text style={styles.muted}>{empty}</Text>
      ) : (
        items.map((p, i) => {
          const subject = subjectName(subjects, p.subjectId);
          const due = dueLabel(p.dueDate, today);
          return (
            <View key={`${p.id}-${i}`} style={styles.row} accessible accessibilityLabel={[pendingTitle(p), subject, due].filter(Boolean).join(', ')}>
              <Text style={styles.rowTitle}>{pendingTitle(p)}</Text>
              {subject ? <Text style={styles.muted}>{subject}</Text> : null}
              {due ? <Text style={[styles.muted, isOverdue(p.dueDate, today) && styles.overdue]}>{due}</Text> : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 19, fontFamily: fonts.bold, color: colors.text },
  overline: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  big: { color: colors.text, fontSize: 22, fontFamily: fonts.bold, marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  heading: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { color: colors.primary, fontSize: 26, fontFamily: fonts.bold },
  statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  row: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  overdue: { color: colors.danger, fontFamily: fonts.semibold },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 6, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  viewAll: { minHeight: 44, justifyContent: 'center' },
  viewAllText: { color: colors.primary, fontSize: 13, fontFamily: fonts.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: colors.primary, fontSize: 13, fontFamily: fonts.medium },
});
