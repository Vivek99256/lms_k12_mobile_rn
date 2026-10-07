import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { DayChip, DayStrip } from '../../components/DayStrip';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../config/theme';
import { useTimetable } from '../../hooks/useTimetable';
import { MenuTile } from '../../menu/types';
import { StaleBanner, studentGate } from './gate';
import { buildTimetable, DAY_KEYS, DAY_NAMES, DayKey, DayTab, defaultDay, periodLabel, timeRange, todayTab } from './timetableModel';

/**
 * The student's weekly timetable: a Monday-Saturday strip that opens on today (a Sunday opens on Monday),
 * with that day's periods in start-time order. Subject and teacher text is shown exactly as the server
 * sends it. Periods whose weekday the server could not map sit under an "Other" chip. Read-only.
 */
export function TimetableScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useTimetable();
  const today = useMemo(() => todayTab(new Date()), []);
  const [picked, setPicked] = useState<DayTab>(() => defaultDay(new Date()));
  const tt = useMemo(() => (q.data ? buildTimetable(q.data) : null), [q.data]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;
  if (!tt) return null;

  if (tt.total === 0) {
    return (
      <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
        <StaleBanner show={q.isError} />
        <EmptyState title="No timetable published yet" hint={`There is no timetable for school year ${user?.syear} yet. It will appear here once your school publishes it.`} />
      </Page>
    );
  }

  const selected: DayTab = picked === 'Other' && !tt.hasOther ? defaultDay(new Date()) : picked;
  const chips: DayChip[] = DAY_KEYS.map((k: DayKey) => ({ key: k, label: k, name: DAY_NAMES[k], hasItems: tt.byDay[k].length > 0, isToday: k === today }));
  if (tt.hasOther) chips.push({ key: 'Other', label: 'Other', name: 'Other days', hasItems: true, isToday: false });
  const periods = tt.byDay[selected];
  const dayName = selected === 'Other' ? 'these days' : DAY_NAMES[selected];

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      <View style={{ gap: spacing.md }}>
        <Text style={styles.caption}>School year {user?.syear}</Text>
        <DayStrip chips={chips} selected={selected} onSelect={(k) => setPicked(k as DayTab)} />
        {selected === 'Other' ? <Text style={styles.caption}>Periods without a weekday from your school.</Text> : null}

        {periods.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No periods on {dayName}.</Text>
          </Card>
        ) : (
          periods.map((p, i) => {
            const time = timeRange(p.start, p.end);
            return (
              <Card key={`${p.periodId}-${i}`}>
                <View accessible accessibilityLabel={periodLabel(p)} style={styles.row}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.time}>{time || '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {p.periodName ? <Text style={styles.period}>{p.periodName}</Text> : null}
                    <Text style={styles.subject}>{p.subject || 'Subject not listed'}</Text>
                    {p.teacher ? <Text style={styles.teacher}>{p.teacher}</Text> : null}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  empty: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  timeBlock: { width: 104, backgroundColor: colors.primarySoft, borderRadius: radius.sm - 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  time: { color: colors.primary, fontSize: 12, fontFamily: fonts.semibold, textAlign: 'center' },
  period: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium },
  subject: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginTop: 2 },
  teacher: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
});
