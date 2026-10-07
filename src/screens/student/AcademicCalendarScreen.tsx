import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { CalendarDay, MonthCalendar } from '../../components/MonthCalendar';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useStudentCalendar } from '../../hooks/useStudentCalendar';
import { MenuTile } from '../../menu/types';
import { localDateKey, longDate, shortDate } from '../../utils/dates';
import {
  addMonths,
  clampMonth,
  compareMonths,
  monthBounds,
  monthGrid,
  monthOf,
  monthTitle,
  WEEKDAYS_MONDAY_FIRST,
  YearMonth,
} from './attendanceModel';
import { monthDays } from './calendarDays';
import { calendarItems, CalendarListItem, itemsInMonth, KIND_LABEL } from './calendarModel';
import { StaleBanner, studentGate } from './gate';

/** The student's academic calendar: holidays, vacations and events on a month grid (Monday first), with day detail. */
export function AcademicCalendarScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const cal = useStudentCalendar();
  const today = useMemo(() => localDateKey(new Date()), []);
  const [ym, setYm] = useState<YearMonth>(() => monthOf(today));
  const [selected, setSelected] = useState<string | null>(null);

  const map = cal.dayMap;
  const items = useMemo(() => (cal.data ? calendarItems(cal.data) : []), [cal.data]);
  const bounds = useMemo(() => (map ? monthBounds(map, today) : { min: monthOf(today), max: monthOf(today) }), [map, today]);
  const shown = clampMonth(ym, bounds);
  const days = useMemo(() => (map ? monthDays(map, shown, false) : new Map<string, CalendarDay>()), [map, shown]);
  const weeks = useMemo(() => monthGrid(shown), [shown]);

  const blocked = studentGate(user, cal);
  if (blocked) return blocked;
  if (!map) return null;

  const go = (delta: number) => {
    setYm(clampMonth(addMonths(shown, delta), bounds));
    setSelected(null);
  };
  const monthItems = itemsInMonth(items, shown);
  const detail = selected ? items.filter((i) => i.date === selected) : [];

  return (
    <Page onRefresh={() => void cal.refetch()} refreshing={cal.isRefetching}>
      <StaleBanner show={cal.isError} />
      {items.length === 0 ? (
        <EmptyState title="No events in the calendar" hint="Holidays, vacations and events will appear here once your school adds them." />
      ) : (
        <View style={{ gap: spacing.md }}>
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
            <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {(
                [
                  [colors.primary, 'Holiday'],
                  [colors.warning, 'Vacation'],
                  ['#4f46e5', 'Event'],
                ] as const
              ).map(([c, t]) => (
                <View key={t} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: c }]} />
                  <Text style={styles.legendText}>{t}</Text>
                </View>
              ))}
            </View>
          </Card>

          {selected ? (
            <Card>
              <Text style={styles.heading}>{longDate(selected)}</Text>
              {detail.length === 0 ? <Text style={styles.muted}>Nothing scheduled.</Text> : detail.map((i, n) => <Row key={n} item={i} withDate={false} />)}
            </Card>
          ) : null}

          <Card>
            <Text style={styles.heading}>In {monthTitle(shown)}</Text>
            {monthItems.length === 0 ? (
              <Text style={styles.muted}>Nothing scheduled this month.</Text>
            ) : (
              monthItems.map((i, n) => <Row key={n} item={i} withDate />)
            )}
          </Card>
        </View>
      )}
    </Page>
  );
}

function Row({ item, withDate }: { item: CalendarListItem; withDate: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${shortDate(item.date)}, ${KIND_LABEL[item.kind]}: ${item.title || KIND_LABEL[item.kind]}`}>
      <Text style={styles.kind}>{withDate ? `${shortDate(item.date)} · ${KIND_LABEL[item.kind]}` : KIND_LABEL[item.kind]}</Text>
      <Text style={styles.title}>{item.title || KIND_LABEL[item.kind]}</Text>
      {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  heading: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginBottom: 2 },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  row: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  kind: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold },
  title: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
});
