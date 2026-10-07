import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { StatusPill } from '../../components/StatusPill';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { StaleBanner, studentGate, QueryLike } from './gate';
import { LIST_PAGE_SIZE } from './listHelpers';
import { CERTIFICATE_NOTICE, RECORDS_NOTE, RecordRow } from './recordsModel';

interface Props<T> {
  q: QueryLike & { data?: T[]; isRefetching: boolean };
  build: (items: T[]) => RecordRow[];
  /** Caption above the list, e.g. "School year 2026" or "All years". */
  caption: (syear: string | null | undefined) => string;
  emptyTitle: (syear: string | null | undefined) => string;
}

/**
 * Shared layout for the S9 record lists. VIEW ONLY: no input, no edit, no share or export. Files and tracking links
 * open only in the phone's browser / viewer (links already validated by the model); the app never downloads, caches
 * or shares them. Record text is rendered as plain text and is never logged.
 */
export function RecordListScreen<T>({ q, build, caption, emptyTitle }: Props<T>) {
  const user = useAuthStore((s) => s.user);
  const rows = useMemo(() => build(q.data ?? []), [q.data, build]);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);
  const [failed, setFailed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const open = (row: RecordRow) => {
    const url = row.link?.url;
    if (!url) return;
    setFailed(null);
    void Promise.resolve()
      .then(() => Linking.openURL(url))
      .catch(() => setFailed(row.key));
  };

  const visible = rows.slice(0, shown);

  return (
    <Page onRefresh={() => void (q.refetch() as unknown)} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle(user?.syear)} hint={RECORDS_NOTE} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>{caption(user?.syear)}</Text>
          {visible.map((row) => {
            const spoken = [row.title, row.date, row.status?.label, ...row.fields.map((f) => `${f.label} ${f.value}`)].filter(Boolean).join('. ');
            return (
              <Card key={row.key}>
                <View accessible accessibilityLabel={spoken} style={{ gap: spacing.xs }}>
                  <Text style={styles.title}>{row.title}</Text>
                  {row.date ? <Text style={styles.muted}>{row.date}</Text> : null}
                  {row.status ? <StatusPill label={row.status.label} tone={row.status.tone} /> : null}
                  {row.fields.map((f) => (
                    <Text key={f.label} style={styles.body}>
                      <Text style={styles.label}>{f.label}: </Text>
                      {f.value}
                    </Text>
                  ))}
                  {row.link?.state === 'unsafe' ? <Text style={styles.warn}>{row.link.unsafeMessage}</Text> : null}
                </View>
                {row.link?.state === 'ready' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Button title={row.link.label} variant="secondary" onPress={() => open(row)} />
                  </View>
                ) : null}
                {row.text !== undefined ? (
                  <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                    <Button title={expanded[row.key] ? 'Hide text' : 'View text'} variant="secondary" onPress={() => setExpanded((e) => ({ ...e, [row.key]: !e[row.key] }))} />
                    {expanded[row.key] ? (
                      <View style={styles.textBox}>
                        <Text style={styles.warn}>{CERTIFICATE_NOTICE}</Text>
                        <Text style={styles.body}>{row.text}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {failed === row.key ? (
                  <Text style={styles.warn} accessibilityRole="alert">
                    Couldn't open the file. Please try again or contact your school.
                  </Text>
                ) : null}
              </Card>
            );
          })}
          {rows.length > visible.length ? (
            <Button title={`Show more (${rows.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
          <Text style={styles.muted}>{RECORDS_NOTE}</Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular },
  label: { color: colors.textMuted, fontFamily: fonts.semibold },
  warn: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
  textBox: { padding: spacing.sm, borderRadius: 10, backgroundColor: colors.primarySoft, gap: spacing.xs },
});
