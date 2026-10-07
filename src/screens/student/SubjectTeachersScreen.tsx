import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useSubjectTeachers } from '../../hooks/useSubjectTeachers';
import { MenuTile } from '../../menu/types';
import { StaleBanner, studentGate } from './gate';
import { teacherRows } from './subjectTeachersModel';

/**
 * The teachers of the student's class and the subjects they teach (`studentTeacherListAPI`). VIEW ONLY. The teacher's
 * mobile number and image URL are dropped when the response is read and never shown or used. The tile's stored
 * `api` is ignored: the screen always calls the fixed read endpoint.
 */
export function SubjectTeachersScreen(_props: { tile: MenuTile }) {
  const user = useAuthStore((s) => s.user);
  const q = useSubjectTeachers();
  const rows = useMemo(() => teacherRows(q.data ?? []), [q.data]);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {rows.length === 0 ? (
        <EmptyState title="No subject teachers to show yet" hint={`Your class timetable has not been set up for school year ${user?.syear}.`} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear}</Text>
          {rows.map((row) => (
            <Card key={row.key}>
              <View accessible accessibilityLabel={`${row.name}${row.subjects.length ? `, ${row.subjects.join(', ')}` : ''}`}>
                <Text style={styles.name}>{row.name}</Text>
                {row.subjects.map((s) => (
                  <Text key={s} style={styles.subject}>
                    {s}
                  </Text>
                ))}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  subject: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, marginTop: 2 },
});
