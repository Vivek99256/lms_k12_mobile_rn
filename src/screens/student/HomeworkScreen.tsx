import { useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Segmented } from '../../components/Segmented';
import { StatusPill } from '../../components/StatusPill';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useHomeworkList } from '../../hooks/useHomeworkList';
import { MenuTile } from '../../menu/types';
import { localDateKey } from '../../utils/dates';
import { StaleBanner, studentGate } from './gate';
import { HomeworkDetail } from './HomeworkDetail';
import {
  DEFAULT_FILTER,
  filterHomework,
  HOMEWORK_PAGE_SIZE,
  HomeworkFilter,
  homeworkCounts,
  metaText,
  rowLabel,
  showsOverdue,
  sortHomework,
  statusInfo,
} from './homeworkModel';

/**
 * The student's homework (view only). Filter To do / Submitted / All (opens on To do), 30 rows at a time, tap a row
 * to expand its details (loaded then, not before). Submitting is S4b and is not here. Token-bound API: the app
 * never sends a student id.
 */
export function HomeworkScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useHomeworkList();
  const queryClient = useQueryClient();
  const today = useMemo(() => localDateKey(new Date()), []);
  const [filter, setFilter] = useState<HomeworkFilter>(DEFAULT_FILTER);
  const [shown, setShown] = useState(HOMEWORK_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const items = q.data;
  const counts = useMemo(() => homeworkCounts(items ?? []), [items]);
  const rows = useMemo(() => sortHomework(filterHomework(items ?? [], filter), filter), [items, filter]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const pick = (f: HomeworkFilter) => {
    setFilter(f);
    setShown(HOMEWORK_PAGE_SIZE);
    setOpenId(null);
  };
  const options = [
    { value: 'todo', label: `To do (${counts.todo})` },
    { value: 'submitted', label: `Submitted (${counts.submitted})` },
    { value: 'all', label: `All (${counts.all})` },
  ] as const;
  const visible = rows.slice(0, shown);

  return (
    <Page
      onRefresh={() => {
        setShown(HOMEWORK_PAGE_SIZE);
        void q.refetch();
        void queryClient.invalidateQueries({ queryKey: ['student-homework-detail'] });
      }}
      refreshing={q.isRefetching}
    >
      <StaleBanner show={q.isError} />
      {!items || items.length === 0 ? (
        <EmptyState title="No homework yet" hint="Homework from your teachers will appear here." />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Segmented options={options} value={filter} onChange={pick} />

          {rows.length === 0 ? (
            filter === 'todo' ? (
              <EmptyState title="All caught up — no homework to do." hint="Choose All to see past homework." />
            ) : (
              <EmptyState title="Nothing submitted yet." hint="Homework you submit will be listed here." />
            )
          ) : (
            visible.map((h, i) => {
              const status = statusInfo(h);
              const meta = metaText(h, today);
              const expanded = openId === h.id;
              return (
                <Card key={`${h.id}-${i}`}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={rowLabel(h, today)}
                    accessibilityHint={expanded ? 'Collapse details' : 'Show details'}
                    accessibilityState={{ expanded }}
                    onPress={() => setOpenId(expanded ? null : h.id)}
                    style={styles.row}
                  >
                    {h.subject.trim() ? <Text style={styles.subject}>{h.subject.trim()}</Text> : null}
                    <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
                      {h.title.trim() || 'Untitled homework'}
                    </Text>
                    {meta ? <Text style={[styles.meta, showsOverdue(h, today) && styles.overdue]}>{meta}</Text> : null}
                    <StatusPill label={status.label} tone={status.tone} />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.detail}>
                      <HomeworkDetail id={h.id} />
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}

          {visible.length < rows.length ? (
            <Button title={`Show more (${rows.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + HOMEWORK_PAGE_SIZE)} />
          ) : null}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, gap: 4 },
  subject: { color: colors.primary, fontSize: 12, fontFamily: fonts.semibold },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  meta: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  overdue: { color: colors.danger, fontFamily: fonts.semibold },
  detail: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
