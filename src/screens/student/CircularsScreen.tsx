import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { isSafeHttpUrl } from '../../utils/links';
import { isApiError, userMessage } from '../../api/errors';
import { CircularItem, CircularKind } from '../../api/student';
import { useAuthStore } from '../../auth/authStore';
import { Segmented } from '../../components/Segmented';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useCirculars } from '../../hooks/useCirculars';
import { MenuTile } from '../../menu/types';
import { displayDate } from '../../utils/dates';
import { safeAttachmentUrl } from './circularModel';
import { StaleBanner, studentGate } from './gate';

const TABS = [
  { value: 'Circular', label: 'Circulars' },
  { value: 'Event', label: 'Events' },
] as const;

/** The server answers HTTP 500 when the student has no enrollment for the year; that cannot be told apart from a real fault. */
function circularError(error: unknown): string {
  const base = userMessage(error);
  return isApiError(error) && error.kind === 'server' && error.status === 500
    ? `${base} This can happen if you are not enrolled for the current school year.`
    : base;
}

/** Circulars and events for the student's class, as two tabs. Tap a card to read it all; attachments open in the browser. */
export function CircularsScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const [kind, setKind] = useState<CircularKind>('Circular');
  const q = useCirculars(kind);

  const blocked = studentGate(user, q, circularError);
  const tabs = <Segmented options={TABS} value={kind} onChange={setKind} />;

  // Keep the tabs visible on every state except the guards, so a failed tab never traps the student on it.
  if (blocked) {
    const guard = !user?.isStudent || !user.syear?.trim();
    return guard ? blocked : <Page>{tabs}{blocked}</Page>;
  }

  const items = q.data ?? [];
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ gap: spacing.md }}>
        {tabs}
        <StaleBanner show={q.isError} />
        {items.length === 0 ? (
          <EmptyState
            title={kind === 'Event' ? 'No events announced' : 'No circulars published'}
            hint={kind === 'Event' ? 'Events for your class will appear here.' : 'Circulars for your class will appear here.'}
          />
        ) : (
          items.map((c, i) => <CircularCard key={`${c.id}-${i}`} item={c} />)
        )}
      </View>
    </Page>
  );
}

function CircularCard({ item }: { item: CircularItem }) {
  const [open, setOpen] = useState(false);
  const attachment = safeAttachmentUrl(item.attachment);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title || 'Untitled'}, ${displayDate(item.date)}`}
        accessibilityHint={open ? 'Collapse' : 'Read the full text'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ minHeight: 44 }}
      >
        <Text style={styles.date}>{displayDate(item.date)}</Text>
        <Text style={styles.title} numberOfLines={open ? undefined : 2}>
          {item.title || 'Untitled'}
        </Text>
        {item.message ? (
          <Text style={styles.body} numberOfLines={open ? undefined : 3}>
            {item.message}
          </Text>
        ) : null}
      </Pressable>
      {attachment ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Open attachment" variant="secondary" onPress={() => { if (isSafeHttpUrl(attachment)) void Linking.openURL(attachment).catch(() => {}); }} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  date: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium },
  title: { color: colors.primary, fontSize: 16, fontFamily: fonts.bold, marginTop: 2 },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginTop: 4 },
});
