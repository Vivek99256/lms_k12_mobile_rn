import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useStudentCalendar } from '../../hooks/useStudentCalendar';
import { MenuTile } from '../../menu/types';
import { shortDate } from '../../utils/dates';
import { calendarItems, groupByMonth } from './calendarModel';
import { StaleBanner, studentGate } from './gate';

/** The school's holidays for the year, in date order, grouped by month. */
export function HolidayListScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const cal = useStudentCalendar('holiday');
  // The server filters to holidays; kind is checked again so a stray row of another type never shows as a holiday.
  const groups = useMemo(() => groupByMonth(calendarItems(cal.data ?? []).filter((i) => i.kind === 'holiday')), [cal.data]);

  const blocked = studentGate(user, cal);
  if (blocked) return blocked;

  return (
    <Page onRefresh={() => void cal.refetch()} refreshing={cal.isRefetching}>
      <StaleBanner show={cal.isError} />
      {groups.length === 0 ? (
        <EmptyState title="No holidays listed" hint="Holidays will appear here once your school adds them." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {groups.map((g) => (
            <Card key={g.key}>
              <Text style={styles.month} accessibilityRole="header">
                {g.title}
              </Text>
              {g.items.map((i, n) => (
                <View key={n} style={styles.row} accessible accessibilityLabel={`${shortDate(i.date)}, ${i.title || 'Holiday'}`}>
                  <Text style={styles.date}>{shortDate(i.date)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{i.title || 'Holiday'}</Text>
                    {i.description ? <Text style={styles.muted}>{i.description}</Text> : null}
                  </View>
                </View>
              ))}
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  month: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginBottom: 2 },
  row: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  date: { width: 86, color: colors.primary, fontSize: 13, fontFamily: fonts.semibold },
  title: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
});
