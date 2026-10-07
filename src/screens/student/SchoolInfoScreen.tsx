import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { LinkedText } from '../../components/LinkedText';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useSchoolInfo } from '../../hooks/useSchoolInfo';
import { MenuTile } from '../../menu/types';
import { StaleBanner, studentGate } from './gate';
import { schoolInfoAction, schoolInfoParts } from './schoolInfoModel';

/**
 * One school-information page (`schoolDetailAPI`). VIEW ONLY. The school's HTML is shown as plain text (images,
 * layout and link targets are lost); only `http(s)` URLs that appear in the text are tappable, via the S1 link rule.
 * The tile's stored `api` is ignored: the screen sends its own fixed action text. A tile whose screen name has no
 * action text makes no request.
 */
export function SchoolInfoScreen({ tile }: { tile: MenuTile }) {
  const action = schoolInfoAction(tile.screenName);
  if (!action) return <EmptyState title="This isn't available in the app yet." hint="Please ask your school." />;
  return <SchoolInfoPage action={action} />;
}

function SchoolInfoPage({ action }: { action: string }) {
  const user = useAuthStore((s) => s.user);
  const q = useSchoolInfo(action);
  const parts = useMemo(() => schoolInfoParts(q.data ?? []), [q.data]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {parts.length === 0 ? (
        <EmptyState title="Nothing published yet" hint="Your school has not added this page yet." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {parts.map((p) => (
            <Card key={p.key}>
              <LinkedText style={styles.body}>{p.text}</LinkedText>
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
});
