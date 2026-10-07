import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useResultFiles } from '../../hooks/useResultFiles';
import { MenuTile } from '../../menu/types';
import { StaleBanner, studentGate } from './gate';
import { isBlockedResultTile, ResultRow, resultRows } from './resultsModel';

/**
 * The term-wise result PDFs the school uploaded for the student (`uploadResultAPI`). VIEW ONLY: the app
 * calculates and shows no marks, percentages or grades - those are inside the PDF. A file opens only in the
 * phone's browser / PDF viewer, after the F1 host check; the app never downloads, caches or shares it.
 */
export function ResultPdfScreen({ tile }: { tile: MenuTile }) {
  // The one tenant whose Result tile points at studentResultPDFAPI (unsafe endpoint): no request is made.
  if (isBlockedResultTile(tile.api)) {
    return <EmptyState title="Result PDFs aren't available in the app yet" hint="Please ask your school for your report card." />;
  }
  return <ResultList />;
}

function ResultList() {
  const user = useAuthStore((s) => s.user);
  const q = useResultFiles();
  const rows = useMemo(() => resultRows(q.data ?? []), [q.data]);
  const [failed, setFailed] = useState<string | null>(null);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const open = (row: ResultRow) => {
    if (!row.url) return;
    setFailed(null);
    // Rejections (no app can open it) and synchronous throws both end up as the same inline notice.
    void Promise.resolve()
      .then(() => Linking.openURL(row.url as string))
      .catch(() => setFailed(row.key));
  };

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState
          title="No results published yet"
          hint={`Your school has not published a result file for school year ${user?.syear}. Please contact your school if you expected one.`}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear}</Text>
          {rows.map((row) => (
            <Card key={row.key}>
              <View accessible accessibilityLabel={`${row.term}, ${row.state === 'ready' ? 'file available' : row.state === 'none' ? 'no file uploaded yet' : 'file cannot be opened from the app'}`}>
                <Text style={styles.term}>{row.term}</Text>
                {row.state === 'none' ? <Text style={styles.muted}>No file uploaded yet</Text> : null}
                {row.state === 'unsafe' ? <Text style={styles.warn}>This file can't be opened from the app</Text> : null}
              </View>
              {row.state === 'ready' ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Button title="Open PDF" variant="secondary" onPress={() => open(row)} />
                </View>
              ) : null}
              {failed === row.key ? (
                <Text style={styles.warn} accessibilityRole="alert">
                  Couldn't open the file. Please try again or contact your school.
                </Text>
              ) : null}
            </Card>
          ))}
          <Text style={styles.muted}>Your marks and grades are in the PDF your school published. Opening a file uses your phone's browser or PDF viewer.</Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  term: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  warn: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
});
