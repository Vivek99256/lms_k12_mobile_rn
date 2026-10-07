import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../config/theme';

export interface DayChip {
  key: string;
  /** Short text on the chip (`Mon`). */
  label: string;
  /** Spoken name (`Monday`). */
  name: string;
  hasItems: boolean;
  isToday: boolean;
}

/**
 * Horizontal strip of day chips (tabs). Each chip is at least 44 dp, shows a dot when the day has
 * something, and announces its name, "today" and "no periods" to screen readers, so colour and the dot
 * are never the only signal.
 */
export function DayStrip({ chips, selected, onSelect }: { chips: readonly DayChip[]; selected: string; onSelect: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {chips.map((c) => {
        const on = c.key === selected;
        return (
          <Pressable
            key={c.key}
            accessibilityRole="tab"
            accessibilityLabel={`${c.name}${c.isToday ? ', today' : ''}${c.hasItems ? '' : ', nothing scheduled'}`}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(c.key)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{c.label}</Text>
            <View style={[styles.dot, !c.hasItems && styles.dotOff, on && c.hasItems && styles.dotOn]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minWidth: 52,
    minHeight: 52,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  labelOn: { color: '#fff' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  dotOff: { backgroundColor: 'transparent' },
  dotOn: { backgroundColor: '#fff' },
});
