import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useParentMessages } from '../../hooks/useParentMessages';
import { MenuTile } from '../../menu/types';
import { messageRows } from './communicationModel';
import { StaleBanner, studentGate } from './gate';
import { LIST_PAGE_SIZE } from './listHelpers';

const NOT_AVAILABLE = "Send a message — This isn't available in the app yet.";

/**
 * The student's own messages to school and the staff replies (`studentParentcommunicationListAPI`, a `status_code`
 * envelope). VIEW ONLY: no compose field, no send. The tile's stored `api` is `add_communicationAPI` - a WRITE
 * endpoint - and is deliberately ignored, so this screen never contacts it.
 */
export function ParentCommunicationScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useParentMessages();
  const rows = useMemo(() => messageRows(q.data ?? []), [q.data]);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const visible = rows.slice(0, shown);

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState title={`No messages for school year ${user?.syear}`} hint={NOT_AVAILABLE} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear}</Text>
          {visible.map((row) => (
            <Card key={row.key}>
              <View
                accessible
                accessibilityLabel={`${row.title}${row.sentOn ? `, sent ${row.sentOn}` : ''}. ${row.hasReply ? `Reply${row.replyBy ? ` from ${row.replyBy}` : ''}.` : 'Awaiting reply.'}`}
                style={{ gap: spacing.xs }}
              >
                <Text style={styles.title}>{row.title}</Text>
                {row.sentOn ? <Text style={styles.muted}>Sent {row.sentOn}</Text> : null}
                {row.message ? <Text style={styles.body}>{row.message}</Text> : null}
                {row.hasReply ? (
                  <View style={styles.reply}>
                    <Text style={styles.replyHead}>
                      Reply{row.replyBy ? ` from ${row.replyBy}` : ''}
                      {row.replyOn ? ` · ${row.replyOn}` : ''}
                    </Text>
                    <Text style={styles.body}>{row.reply}</Text>
                  </View>
                ) : (
                  <Text style={styles.pending}>Awaiting reply</Text>
                )}
              </View>
            </Card>
          ))}
          {rows.length > visible.length ? (
            <Button title={`Show more (${rows.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
          <Text style={styles.muted}>{NOT_AVAILABLE}</Text>
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
  pending: { color: colors.warning, fontSize: 13, fontFamily: fonts.semibold },
  reply: { marginTop: spacing.xs, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.primarySoft, gap: 2 },
  replyHead: { color: colors.primary, fontSize: 12, fontFamily: fonts.semibold },
});
