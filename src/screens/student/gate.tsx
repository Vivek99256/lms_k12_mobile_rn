import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { userMessage } from '../../api/errors';
import { AuthUser } from '../../auth/types';
import { Card, EmptyState, ErrorState, Loading } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';

/** The few fields of a TanStack query result the gate needs. */
export interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Early-return states shared by the student screens, in this order:
 *  - not a student session      -> "Students only" (defence in depth on top of the menu check; no request is made)
 *  - no school year in the login -> "School year not set" (no request is made)
 *  - loading                     -> Loading
 *  - failed with nothing cached  -> ErrorState with a retry
 * Returns null when the screen can render its content (it may still show a StaleBanner).
 */
export function studentGate(user: AuthUser | null, q: QueryLike, errorMessage: (error: unknown) => string = userMessage): React.ReactElement | null {
  if (!user?.isStudent) return <EmptyState title="Students only" hint="This screen is for students." />;
  if (!user.syear?.trim()) {
    return <EmptyState title="School year not set" hint="Your school has not set the current academic year yet. Please contact your school." />;
  }
  if (q.isLoading) return <Loading />;
  if (q.isError && q.data === undefined) return <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />;
  if (q.data === undefined) return <Loading />;
  return null;
}

/** One line shown above cached content when a refresh failed. */
export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Card style={styles.banner}>
      <Text style={styles.text} accessibilityRole="alert">
        Couldn't refresh — showing the last loaded data.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.dangerSoft, marginBottom: spacing.md },
  text: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
});
