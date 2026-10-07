import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../config/theme';

/** Plain data the calendar needs per day; the screen decides what each day means. */
export interface CalendarDay {
  status?: 'present' | 'absent' | 'other';
  /** Short text shown inside the cell for a recorded status (`P`, `A`, or the entered code). */
  mark?: string;
  holiday?: boolean;
  vacation?: boolean;
  event?: boolean;
  /** Screen-reader label for the cell. */
  label: string;
}

const EVENT_DOT = '#4f46e5';

/**
 * Month grid with a title and previous/next buttons. Colour is never the only signal: recorded days
 * carry a letter, holiday-only days an `H`, and every cell has an accessibility label. Cells are at
 * least 44 dp high.
 */
export function MonthCalendar({
  title,
  weekdays,
  weeks,
  days,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
}: {
  title: string;
  weekdays: readonly string[];
  weeks: (string | null)[][];
  days: ReadonlyMap<string, CalendarDay>;
  selected: string | null;
  today: string;
  onSelect: (key: string) => void;
  /** Omit to disable the button. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <View>
      <View style={styles.header}>
        <NavButton label="Previous month" glyph="‹" onPress={onPrev} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <NavButton label="Next month" glyph="›" onPress={onNext} />
      </View>

      <View style={styles.row}>
        {weekdays.map((w) => (
          <Text key={w} style={styles.weekday} accessibilityElementsHidden importantForAccessibility="no">
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((key, ci) => (key ? <Cell key={key} dayKey={key} info={days.get(key)} selected={key === selected} isToday={key === today} onSelect={onSelect} /> : <View key={`pad-${ci}`} style={styles.cell} />))}
        </View>
      ))}
    </View>
  );
}

function NavButton({ label, glyph, onPress }: { label: string; glyph: string; onPress?: () => void }) {
  const off = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      hitSlop={8}
      style={[styles.nav, off && { opacity: 0.35 }]}
    >
      <Text style={styles.navGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function Cell({
  dayKey,
  info,
  selected,
  isToday,
  onSelect,
}: {
  dayKey: string;
  info?: CalendarDay;
  selected: boolean;
  isToday: boolean;
  onSelect: (key: string) => void;
}) {
  const tone =
    info?.status === 'present'
      ? { bg: colors.successSoft, fg: colors.success }
      : info?.status === 'absent'
        ? { bg: colors.dangerSoft, fg: colors.danger }
        : info?.status === 'other'
          ? { bg: '#f1f5f9', fg: colors.textMuted }
          : info?.holiday
            ? { bg: colors.primarySoft, fg: colors.primary }
            : { bg: 'transparent', fg: colors.text };
  const mark = info?.mark ?? (info?.holiday && !info?.status ? 'H' : '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={info?.label ?? dayKey}
      accessibilityState={{ selected }}
      onPress={() => onSelect(dayKey)}
      style={[styles.cell, styles.dayCell, { backgroundColor: tone.bg }, isToday && styles.today, selected && styles.selected]}
    >
      <Text style={[styles.dayNumber, { color: tone.fg }]}>{Number(dayKey.slice(8, 10))}</Text>
      <Text style={[styles.mark, { color: tone.fg }]}>{mark}</Text>
      <View style={styles.dots}>
        {info?.holiday ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        {info?.vacation ? <View style={[styles.dot, { backgroundColor: colors.warning }]} /> : null}
        {info?.event ? <View style={[styles.dot, { backgroundColor: EVENT_DOT }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },
  nav: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  navGlyph: { color: colors.primary, fontSize: 26, lineHeight: 28, fontFamily: fonts.bold },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold, paddingBottom: 6 },
  cell: { flex: 1, minHeight: 44, margin: 1.5 },
  dayCell: { borderRadius: radius.sm - 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayNumber: { fontSize: 14, fontFamily: fonts.semibold },
  mark: { fontSize: 10, fontFamily: fonts.bold, height: 12, lineHeight: 12 },
  dots: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  selected: { borderWidth: 2, borderColor: colors.text },
});
