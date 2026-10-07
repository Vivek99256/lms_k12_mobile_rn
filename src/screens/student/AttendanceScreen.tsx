import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { userMessage } from '../../api/errors';
import { useAuthStore } from '../../auth/authStore';
import { CalendarDay, MonthCalendar } from '../../components/MonthCalendar';
import { Card, EmptyState, ErrorState, Loading, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useStudentAttendance } from '../../hooks/useStudentAttendance';
import { MenuTile } from '../../menu/types';
import {
  addMonths,
  clampMonth,
  compareMonths,
  formatLongDate,
  monthBounds,
  monthGrid,
  monthOf,
  monthSummary,
  monthTitle,
  statusText,
  summarise,
  todayKey,
  WEEKDAYS_MONDAY_FIRST,
  YearMonth,
} from './attendanceModel';
import { monthDays } from './calendarDays';

const pct = (p: number | null) => (p == null ? '—' : `${p}%`);

/** The student's own attendance: month calendar, totals, and per-day detail. Read-only. */
export function AttendanceScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const att = useStudentAttendance();
  const today = useMemo(() => todayKey(new Date()), []);
  const [ym, setYm] = useState<YearMonth>(() => monthOf(today));
  const [selected, setSelected] = useState<string | null>(null);

  const map = att.dayMap;
  const bounds = useMemo(() => (map ? monthBounds(map, today) : { min: monthOf(today), max: monthOf(today) }), [map, today]);
  const shown = clampMonth(ym, bounds);
  const days = useMemo(() => (map ? monthDays(map, shown) : new Map<string, CalendarDay>()), [map, shown]);
  const weeks = useMemo(() => monthGrid(shown), [shown]);

  // Defence in depth on top of the menu check in TileScreen: this screen is for the student session only.
  if (!user?.isStudent) return <EmptyState title="Students only" hint="This screen is for students." />;
  if (!user.syear?.trim()) {
    return <EmptyState title="School year not set" hint="Your school has not set the current academic year yet. Please contact your school." />;
  }
  if (att.isLoading) return <Loading />;
  if (att.isError && !map) return <ErrorState message={userMessage(att.error)} onRetry={() => void att.refetch()} />;
  if (!map) return <Loading />;

  const empty = map.size === 0;
  const month = monthSummary(map, shown);
  const year = summarise(map);
  const detail = selected ? map.get(selected) : undefined;
  const go = (delta: number) => {
    setYm(clampMonth(addMonths(shown, delta), bounds));
    setSelected(null);
  };

  return (
    <Page onRefresh={() => void att.refetch()} refreshing={att.isRefetching}>
      {att.isError ? (
        <Card style={styles.banner}>
          <Text style={styles.bannerText} accessibilityRole="alert">
            Couldn't refresh — showing the last loaded data.
          </Text>
        </Card>
      ) : null}

      {empty ? (
        <EmptyState title="No attendance recorded yet" hint="Your attendance will appear here once your teacher marks it." />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card>
            <Text style={styles.overline}>Attendance in {monthTitle(shown)}</Text>
            <Text style={styles.big} accessibilityLabel={`Attendance ${month.percent == null ? 'not available' : `${month.percent} percent`}`}>
              {pct(month.percent)}
            </Text>
            <View style={styles.stats}>
              <Stat label="Present" value={month.present} color={colors.success} />
              <Stat label="Absent" value={month.absent} color={colors.danger} />
              <Stat label="Holidays" value={month.holidays} color={colors.primary} />
            </View>
            {month.other > 0 ? <Text style={styles.note}>{month.other} day(s) with another code are not counted in the percentage.</Text> : null}
          </Card>

          <Card>
            <MonthCalendar
              title={monthTitle(shown)}
              weekdays={WEEKDAYS_MONDAY_FIRST}
              weeks={weeks}
              days={days}
              selected={selected}
              today={today}
              onSelect={(k) => setSelected((cur) => (cur === k ? null : k))}
              onPrev={compareMonths(shown, bounds.min) > 0 ? () => go(-1) : undefined}
              onNext={compareMonths(shown, bounds.max) < 0 ? () => go(1) : undefined}
            />
            <Legend />
          </Card>

          {selected ? (
            <Card>
              <Text style={styles.detailTitle}>{formatLongDate(selected)}</Text>
              <Text style={styles.detailStatus}>{statusText(detail)}</Text>
              {(detail?.holidays ?? []).map((e, i) => (
                <Entry key={`h${i}`} kind="Holiday" title={e.title} description={e.description} />
              ))}
              {(detail?.vacations ?? []).map((e, i) => (
                <Entry key={`v${i}`} kind="Vacation" title={e.title} description={e.description} />
              ))}
              {(detail?.events ?? []).map((e, i) => (
                <Entry key={`e${i}`} kind="Event" title={e.title} description={e.description} />
              ))}
            </Card>
          ) : null}

          <Text style={styles.note}>
            Academic year {user.syear}: {year.present} present · {year.absent} absent · {pct(year.percent)}
          </Text>
        </View>
      )}
    </Page>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Legend() {
  const items: [string, string][] = [
    [colors.success, 'P Present'],
    [colors.danger, 'A Absent'],
    [colors.primary, 'Holiday'],
    [colors.warning, 'Vacation'],
    ['#4f46e5', 'Event'],
  ];
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map(([c, t]) => (
        <View key={t} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c }]} />
          <Text style={styles.legendText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Entry({ kind, title, description }: { kind: string; title: string; description: string }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.entryKind}>{kind}</Text>
      <Text style={styles.entryTitle}>{title || kind}</Text>
      {description ? <Text style={styles.entryDesc}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.dangerSoft, marginBottom: spacing.md },
  bannerText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
  overline: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  big: { color: colors.text, fontSize: 40, fontFamily: fonts.bold, marginVertical: 2 },
  stats: { flexDirection: 'row', marginTop: spacing.sm },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontFamily: fonts.bold },
  statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium },
  note: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 4, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  detailTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  detailStatus: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold, marginTop: 2 },
  entry: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryKind: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold },
  entryTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  entryDesc: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
});
