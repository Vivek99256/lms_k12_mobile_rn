import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../config/theme';
import { MenuSection, MenuTile } from '../menu/types';
import { RootStackParams } from '../navigation/types';
import { tileEmoji, tintFor } from '../utils/tileIcon';
import { Bounce, FadeInUp } from './motion';
import { EmptyState } from './ui';

function useOpenTile() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return (t: MenuTile) => nav.navigate('Tile', { key: t.key, title: t.title });
}

/** Swipeable row of the most-used shortcuts: big colourful cards that bounce when pressed. */
export function QuickActions({ tiles }: { tiles: MenuTile[] }) {
  const open = useOpenTile();
  if (!tiles.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.heading}>Quick actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm + 2, paddingRight: spacing.md }}
        style={{ marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}
      >
        {tiles.map((t, i) => {
          const c = tintFor(i);
          return (
            <FadeInUp key={t.key} delay={i * 80} distance={0}>
              <Bounce onPress={() => open(t)} accessibilityLabel={t.title} style={[styles.quick, { backgroundColor: c.solid }]}>
                <View style={[styles.quickDot, { backgroundColor: c.on }]} />
                <Text style={styles.quickEmoji}>{tileEmoji(t.title)}</Text>
                <Text style={[styles.quickText, { color: c.on }]} numberOfLines={2}>
                  {t.title}
                </Text>
              </Bounce>
            </FadeInUp>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Sections of tiles as chunky list rows. Renders exactly what the backend returned. */
export function TileList({ sections }: { sections: MenuSection[] }) {
  const open = useOpenTile();
  if (!sections.length) {
    return <EmptyState title="No screens assigned" hint="Your role has no mobile screens yet. Contact your administrator." />;
  }
  let n = 0;
  return (
    <View style={{ gap: spacing.lg }}>
      {sections.map((s, si) => {
        const c = tintFor(si);
        return (
          <View key={`${si}-${s.title}`} style={{ gap: spacing.sm + 2 }}>
            <View style={styles.headingRow}>
              <View style={[styles.sectionDot, { backgroundColor: c.solid }]} />
              <Text style={[styles.heading, { flex: 1 }]} accessibilityRole="header">
                {s.title}
              </Text>
              <View style={[styles.count, { backgroundColor: c.soft }]}>
                <Text style={{ color: c.fg, fontSize: 12, fontFamily: fonts.bold }}>{s.tiles.length}</Text>
              </View>
            </View>
            {s.tiles.map((t) => {
              const delay = Math.min(n++, 12) * 55; // cap the stagger so long lists don't crawl
              return (
                <FadeInUp key={t.key} delay={delay}>
                  <Bounce onPress={() => open(t)} accessibilityLabel={t.title} scaleTo={0.97} style={styles.row}>
                    <View style={[styles.emojiBubble, { backgroundColor: c.soft }]}>
                      <Text style={{ fontSize: 24 }}>{tileEmoji(t.title)}</Text>
                    </View>
                    <Text style={styles.rowText} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <View style={[styles.chevron, { backgroundColor: c.solid }]}>
                      <Ionicons name="arrow-forward" size={16} color={c.on} />
                    </View>
                  </Bounce>
                </FadeInUp>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionDot: { width: 12, height: 12, borderRadius: 6 },
  heading: { color: colors.text, fontSize: 19, fontFamily: fonts.bold },
  count: { minWidth: 28, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quick: {
    width: 128,
    height: 128,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadow,
  },
  quickDot: { position: 'absolute', top: -26, right: -26, width: 84, height: 84, borderRadius: 42, opacity: 0.12 },
  quickEmoji: { fontSize: 34 },
  quickText: { fontSize: 14, fontFamily: fonts.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    ...shadow,
  },
  emojiBubble: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  chevron: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
