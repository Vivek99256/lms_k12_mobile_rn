import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../config/theme';

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: '#f1f5f9', fg: colors.textMuted },
  info: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: '#fffbeb', fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

/** A short status word in a tinted pill. The word is the meaning; the tint only reinforces it. */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]} accessible accessibilityLabel={`Status: ${label}`}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontFamily: fonts.semibold },
});
