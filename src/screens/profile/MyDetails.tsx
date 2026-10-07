import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isApiError, userMessage } from '../../api/errors';
import { Button, Card, ErrorState, Loading } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useMyDetails } from '../../hooks/useOwnProfile';
import { MISMATCH_MESSAGE } from './profileModel';

/**
 * The "My details" card. Mounted only after the user taps "Show my details"; unmounting it (Hide) drops the data.
 * Mobile is plain text, never a link. Nothing here can display a record that failed the identity check.
 */
export function MyDetails({ onHide }: { onHide: () => void }) {
  const q = useMyDetails();

  let body: React.ReactNode;
  if (q.isLoading) {
    body = <Loading label="Loading your details…" />;
  } else if (q.isError) {
    const notFound = isApiError(q.error) && q.error.status === 404;
    body = notFound ? (
      <Text style={styles.note}>Your details aren't available.</Text>
    ) : (
      // A missing academic year (422) shows the server's own message; everything else uses the shared F1 messages.
      <ErrorState message={userMessage(q.error)} onRetry={() => void q.refetch()} />
    );
  } else if (!q.data || q.data.kind === 'mismatch') {
    body = <Text style={styles.note}>{MISMATCH_MESSAGE}</Text>;
  } else if (q.data.kind === 'empty') {
    body = <Text style={styles.note}>Your school hasn't added more details yet.</Text>;
  } else {
    body = (
      <View>
        {q.data.rows.map((r, i) => (
          <View key={r.label} accessible accessibilityLabel={`${r.label}: ${r.value}`} style={[styles.row, i ? styles.rowBorder : null]}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.value}>{r.value}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Card>
      <Text style={styles.heading} accessibilityRole="header">
        My details
      </Text>
      {body}
      <View style={{ marginTop: spacing.md }}>
        <Button title="Hide details" variant="secondary" onPress={onHide} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginBottom: spacing.sm },
  note: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular },
  row: { paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  label: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  value: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
});
