import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../config/theme';

/** Two-or-three way switch (tabs). Each segment is at least 44 dp high and announces its selected state. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.item, selected && styles.itemSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 4, gap: 4 },
  item: { flex: 1, minHeight: 44, borderRadius: radius.md - 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  itemSelected: { backgroundColor: colors.surface },
  label: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.semibold },
  labelSelected: { color: colors.primary },
});
