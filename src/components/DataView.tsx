import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../config/theme';
import { tintFor } from '../utils/tileIcon';
import { CountUp, FadeInUp } from './motion';
import { Card, EmptyState } from './ui';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isScalar = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v);
const isNum = (v: unknown): v is number | string =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^-?[\d,.]+%?$/.test(v.trim()));

const label = (k: string) => k.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const show = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

// Hide plumbing the user should never see.
const HIDDEN = /(^|_)(id|token|password|sub_institute_id|created_by|updated_at|created_at|deleted_at)$/i;

function visible(obj: Record<string, unknown>) {
  return Object.entries(obj).filter(([k, v]) => isScalar(v) && v !== '' && !HIDDEN.test(k));
}

function Rows({ obj }: { obj: Record<string, unknown> }) {
  const rows = visible(obj);
  if (!rows.length) return null;
  return (
    <>
      {rows.map(([k, v], i) => (
        <View key={k} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Text style={styles.key}>{label(k)}</Text>
          <Text style={styles.value}>{show(v)}</Text>
        </View>
      ))}
    </>
  );
}

/** Numeric top-level fields become big stat cards; the rest stay as label/value rows. */
function Summary({ obj }: { obj: Record<string, unknown> }) {
  const rows = visible(obj);
  const stats = rows.filter(([, v]) => isNum(v));
  const rest = Object.fromEntries(rows.filter(([, v]) => !isNum(v)));
  return (
    <View style={{ gap: spacing.md }}>
      {stats.length ? (
        <View style={styles.statGrid}>
          {stats.map(([k, v], i) => {
            const t = tintFor(i);
            return (
              <FadeInUp key={k} delay={i * 70} style={styles.statWrap}>
                <View style={[styles.stat, { backgroundColor: t.solid }]}>
                  <View style={[styles.statDot, { backgroundColor: t.on, opacity: 0.12 }]} />
                  <CountUp value={show(v)} style={[styles.statValue, { color: t.on }]} />
                  <Text style={[styles.statLabel, { color: t.on }]} numberOfLines={2}>
                    {label(k)}
                  </Text>
                </View>
              </FadeInUp>
            );
          })}
        </View>
      ) : null}
      {Object.keys(rest).length ? (
        <Card>
          <Rows obj={rest} />
        </Card>
      ) : null}
    </View>
  );
}

/**
 * Generic renderer for ERP responses we have no dedicated screen for: numbers become stat
 * cards, other scalars label/value rows, arrays of records cards, nested objects recurse.
 */
export function DataView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data == null || data === '') return <EmptyState title="Nothing to show yet" />;
  if (isScalar(data)) return <Text style={styles.value}>{show(data)}</Text>;

  if (Array.isArray(data)) {
    if (!data.length) return <EmptyState title="Nothing to show yet" />;
    return (
      <View style={{ gap: spacing.sm }}>
        {data.map((item, i) => (
          <Card key={i}>{isObj(item) ? <Rows obj={item} /> : <Text style={styles.value}>{show(item)}</Text>}</Card>
        ))}
      </View>
    );
  }

  const nested = Object.entries(data as Record<string, unknown>).filter(([, v]) => v && typeof v === 'object');
  const hasScalars = visible(data as Record<string, unknown>).length > 0;
  return (
    <View style={{ gap: spacing.md }}>
      {hasScalars ? <Summary obj={data as Record<string, unknown>} /> : null}
      {depth < 2
        ? nested.map(([k, v]) => (
            <View key={k} style={{ gap: spacing.sm }}>
              <Text style={styles.heading}>{label(k)}</Text>
              <DataView data={v} depth={depth + 1} />
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: spacing.md },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  key: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' },
  heading: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  statWrap: { width: '48%' },
  stat: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    overflow: 'hidden',
    minHeight: 96,
    justifyContent: 'flex-end',
    ...shadow,
  },
  statDot: { position: 'absolute', top: -22, right: -22, width: 80, height: 80, borderRadius: 40 },
  statValue: { fontSize: 30, fontFamily: fonts.bold },
  statLabel: { fontSize: 12, fontFamily: fonts.semibold, opacity: 0.85 },
});
