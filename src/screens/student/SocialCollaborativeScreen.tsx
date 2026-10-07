import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { isApiError, userMessage } from '../../api/errors';
import { useAuthStore } from '../../auth/authStore';
import { Button, Card, EmptyState, ErrorState, Loading, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useDiscussion, useMyDiscussions } from '../../hooks/useDiscussions';
import { MenuTile } from '../../menu/types';
import { DiscussionRow, ownDiscussionRows, threadView } from './discussionModel';
import { StaleBanner, studentGate } from './gate';
import { LIST_PAGE_SIZE } from './listHelpers';

const NOT_AVAILABLE_NOTE = "Starting a discussion or replying isn't available in the app yet.";

/**
 * The student's OWN discussions (modern token-bound API, always `mine=1`) and the conversation on each. VIEW ONLY: no post,
 * comment, edit or delete. The tenant / public feed is never requested, and anything that is not provably the student's own
 * is never shown. Attachments open only in the phone's browser / viewer after the link check; no image is fetched
 * (avatars are ignored). The tile's stored `api` is ignored.
 */
export function SocialCollaborativeScreen(_props: { tile: MenuTile }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId ? <Thread id={openId} onBack={() => setOpenId(null)} /> : <DiscussionList onOpen={setOpenId} />;
}

function openLink(url: string | null, onFail: () => void) {
  if (!url) return;
  void Promise.resolve()
    .then(() => Linking.openURL(url))
    .catch(onFail);
}

function DiscussionList({ onOpen }: { onOpen: (id: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const q = useMyDiscussions();
  const rows = useMemo(() => (user ? ownDiscussionRows(q.data ?? [], user.id) : []), [q.data, user]);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const visible = rows.slice(0, shown);

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState title="You haven't started any discussions" hint={NOT_AVAILABLE_NOTE} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>My discussions · School year {user?.syear}</Text>
          {visible.map((row) => (
            <DiscussionCard key={row.id} row={row} onOpen={() => onOpen(row.id)} />
          ))}
          {rows.length > visible.length ? (
            <Button title={`Show more (${rows.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
          <Text style={styles.muted}>{NOT_AVAILABLE_NOTE}</Text>
        </View>
      )}
    </Page>
  );
}

function DiscussionCard({ row, onOpen }: { row: DiscussionRow; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const meta = [row.date, row.visibility, row.replies > 0 ? `${row.replies} ${row.replies === 1 ? 'reply' : 'replies'}` : ''].filter(Boolean).join(' · ');
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`${row.title}${meta ? `, ${meta}` : ''}`} onPress={onOpen} style={{ gap: spacing.xs, minHeight: 44 }}>
        <Text style={styles.title}>{row.title}</Text>
        {meta ? <Text style={styles.muted}>{meta}</Text> : null}
        {row.text ? (
          <Text style={styles.body} numberOfLines={3}>
            {row.text}
          </Text>
        ) : null}
        {row.attachment.state === 'unsafe' ? <Text style={styles.warn}>Attachment can't be opened from the app</Text> : null}
      </Pressable>
      {row.attachment.state === 'ready' ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            title="Open attachment"
            variant="secondary"
            onPress={() => {
              setFailed(false);
              openLink(row.attachment.url, () => setFailed(true));
            }}
          />
        </View>
      ) : null}
      {failed ? (
        <Text style={styles.warn} accessibilityRole="alert">
          Couldn't open the file. Please try again or contact your school.
        </Text>
      ) : null}
    </Card>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const q = useDiscussion(id);
  const view = useMemo(() => (q.data && user ? threadView(q.data, user.id) : null), [q.data, user]);
  const [failed, setFailed] = useState(false);

  const back = (
    <View style={{ marginBottom: spacing.md }}>
      <Button title="Back to my discussions" variant="secondary" onPress={onBack} />
    </View>
  );

  if (!user?.isStudent || !user.syear?.trim()) return studentGate(user, q) ?? null;
  if (q.isLoading) return <Loading />;
  if (q.isError && q.data === undefined) {
    // A 404 means the discussion is not visible to this student (the server's own rule).
    const msg = isApiError(q.error) && q.error.status === 404 ? 'This discussion is not available.' : userMessage(q.error);
    return (
      <Page>
        {back}
        <ErrorState message={msg} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  if (q.data === undefined) return <Loading />;
  if (!view) {
    return (
      <Page>
        {back}
        <EmptyState title="This discussion is not available." hint="Please go back to your discussions." />
      </Page>
    );
  }

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {back}
      <StaleBanner show={q.isError} />
      <View style={{ gap: spacing.md }}>
        <Card>
          <Text style={styles.title}>{view.title}</Text>
          {view.date ? <Text style={styles.muted}>{view.date}</Text> : null}
          {view.text ? <Text style={styles.body}>{view.text}</Text> : null}
          {view.attachment.state === 'unsafe' ? <Text style={styles.warn}>Attachment can't be opened from the app</Text> : null}
          {view.attachment.state === 'ready' ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Open attachment"
                variant="secondary"
                onPress={() => {
                  setFailed(false);
                  openLink(view.attachment.url, () => setFailed(true));
                }}
              />
            </View>
          ) : null}
          {failed ? (
            <Text style={styles.warn} accessibilityRole="alert">
              Couldn't open the file. Please try again or contact your school.
            </Text>
          ) : null}
        </Card>
        {view.messages.length === 0 ? (
          <Text style={styles.muted}>No replies yet.</Text>
        ) : (
          view.messages.map((m) => (
            <Card key={m.key}>
              <View accessible accessibilityLabel={`${m.author}${m.date ? `, ${m.date}` : ''}. ${m.text}`}>
                <Text style={[styles.author, m.mine && { color: colors.primary }]}>{m.author}</Text>
                {m.date ? <Text style={styles.muted}>{m.date}</Text> : null}
                <Text style={styles.body}>{m.text}</Text>
              </View>
            </Card>
          ))
        )}
        <Text style={styles.muted}>{NOT_AVAILABLE_NOTE}</Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  author: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular },
  warn: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
});
