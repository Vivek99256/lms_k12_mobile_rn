import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { LinkedText } from '../../components/LinkedText';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useNotificationHub } from '../../hooks/useNotificationHub';
import { MenuTile } from '../../menu/types';
import { localDateKey } from '../../utils/dates';
import { tileEmoji } from '../../utils/tileIcon';
import { StaleBanner, studentGate } from './gate';
import { groupNotifications, limitGroups, NOTIFICATION_PAGE_SIZE } from './notificationModel';

/**
 * The student's notifications, newest day first. The server returns all of them at once, so the list is
 * shown NOTIFICATION_PAGE_SIZE at a time (S1-D5). Text is plain; only http(s) links are tappable (S1-D6);
 * server image URLs are never loaded (S1-D3).
 */
export function NotificationHubScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useNotificationHub();
  const today = useMemo(() => localDateKey(new Date()), []);
  const [shown, setShown] = useState(NOTIFICATION_PAGE_SIZE);

  const all = useMemo(() => groupNotifications(q.data ?? [], today), [q.data, today]);
  const visible = useMemo(() => limitGroups(all, shown), [all, shown]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const total = q.data?.length ?? 0;
  const showing = visible.reduce((n, g) => n + g.items.length, 0);

  return (
    <Page
      onRefresh={() => {
        setShown(NOTIFICATION_PAGE_SIZE);
        void q.refetch();
      }}
      refreshing={q.isRefetching}
    >
      <StaleBanner show={q.isError} />
      {total === 0 ? (
        <EmptyState title="No notifications yet" hint="Messages from your school will appear here." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {visible.map((g) => (
            <View key={g.key} style={{ gap: spacing.sm }}>
              <Text style={styles.day} accessibilityRole="header">
                {g.label}
              </Text>
              {g.items.map((n, i) => (
                <Card key={`${n.id}-${i}`}>
                  <View style={styles.head}>
                    <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                      {tileEmoji(n.type)}
                    </Text>
                    <Text style={styles.type}>{n.type || 'Notification'}</Text>
                  </View>
                  {n.description ? <LinkedText style={styles.body}>{n.description}</LinkedText> : null}
                </Card>
              ))}
            </View>
          ))}
          {showing < total ? (
            <Button title={`Show more (${total - showing} older)`} variant="secondary" onPress={() => setShown((s) => s + NOTIFICATION_PAGE_SIZE)} />
          ) : null}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  day: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.semibold, marginTop: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  emoji: { fontSize: 20 },
  type: { color: colors.text, fontSize: 15, fontFamily: fonts.bold, flexShrink: 1 },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
});
