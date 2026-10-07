import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { userMessage } from '../../api/errors';
import { HomeworkFile, isHomeworkId } from '../../api/student';
import { LinkedText } from '../../components/LinkedText';
import { StatusPill } from '../../components/StatusPill';
import { Button } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useHomeworkDetail } from '../../hooks/useHomeworkDetail';
import { displayDate } from '../../utils/dates';
import { stripHtml } from '../../utils/text';
import { safeAttachmentUrl } from './circularModel';
import { statusInfo } from './homeworkModel';

/**
 * The expanded part of a homework row (view only). It only exists while the row is open, so a collapsed row
 * makes no request. A homework id that is not plain digits is never put in a URL.
 */
export function HomeworkDetail({ id }: { id: string }) {
  if (!isHomeworkId(id)) return <Text style={styles.muted}>Details are not available for this item.</Text>;
  return <DetailBody id={id} />;
}

const open = (url: string) => void Linking.openURL(url).catch(() => {});

function DetailBody({ id }: { id: string }) {
  const q = useHomeworkDetail(id);

  if (q.isLoading) {
    return (
      <Text style={styles.muted} accessibilityLiveRegion="polite">
        Loading details…
      </Text>
    );
  }
  if (!q.data) {
    if (!q.isError) return null; // query not enabled (not a student session): nothing to show, nothing to blame
    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.error} accessibilityRole="alert">
          {userMessage(q.error)}
        </Text>
        <Button title="Try again" variant="secondary" onPress={() => void q.refetch()} />
      </View>
    );
  }

  const d = q.data;
  const reference = safeAttachmentUrl(d.referenceUrl);
  const meta = [d.teacher && `Teacher: ${d.teacher}`, [d.standard, d.division].filter(Boolean).join(' · ')].filter(Boolean).join('  ·  ');
  const sub = d.submission;

  return (
    <View style={{ gap: spacing.md }}>
      {q.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          Couldn't refresh — showing the last loaded details.
        </Text>
      ) : null}
      {meta ? <Text style={styles.muted}>{meta}</Text> : null}

      <View>
        <Text style={styles.heading}>Instructions</Text>
        {d.description.trim() ? <LinkedText style={styles.body}>{d.description}</LinkedText> : <Text style={styles.muted}>No instructions provided.</Text>}
      </View>

      {reference ? <Button title="Open attachment" variant="secondary" onPress={() => open(reference)} /> : null}

      {d.questions.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.heading}>Questions</Text>
          {d.questions.map((qu, i) => {
            const text = stripHtml(qu.title) || stripHtml(qu.description) || `Question ${i + 1}`;
            return (
              <View key={`${qu.id}-${i}`} accessible accessibilityLabel={`Question ${i + 1}. ${text}${qu.points !== null ? `, ${marks(qu.points)}` : ''}`}>
                <Text style={styles.body}>
                  {i + 1}. {text}
                </Text>
                {qu.points !== null ? <Text style={styles.muted}>{marks(qu.points)}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.heading}>Your submission</Text>
        {!sub ? (
          <Text style={styles.muted}>You haven't submitted this homework yet.</Text>
        ) : (
          <>
            <StatusPill {...statusInfo({ status: sub.status || 'Pending', fileCount: sub.files.length, aiStatus: sub.aiStatus })} />
            {sub.submittedAt ? <Text style={styles.muted}>Submitted {displayDate(sub.submittedAt)}</Text> : null}
            {sub.remarks.trim() ? <Text style={styles.body}>{sub.remarks}</Text> : null}
            {sub.files.map((f, i) => (
              <FileRow key={`${f.id}-${i}`} file={f} />
            ))}
            {sub.feedbackPublished && sub.teacherRemarks.trim() ? (
              <View style={styles.remarks}>
                <Text style={styles.remarksLabel}>Teacher remarks</Text>
                <Text style={styles.body}>{sub.teacherRemarks}</Text>
              </View>
            ) : null}
            {sub.aiStatus.trim().toLowerCase() === 'evaluated' ? (
              <Text style={styles.muted}>
                AI score: {sub.aiScore ?? '-'}
                {sub.aiTotal ? ` / ${sub.aiTotal}` : ''}
                {sub.aiPercentage !== null ? ` (${sub.aiPercentage}%)` : ''}
              </Text>
            ) : sub.aiStatus.trim().toLowerCase() === 'checking' ? (
              <Text style={styles.muted}>AI is checking this submission…</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const marks = (n: number) => `${n} ${n === 1 ? 'mark' : 'marks'}`;

function FileRow({ file }: { file: HomeworkFile }) {
  const url = safeAttachmentUrl(file.url);
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.body}>{file.name || 'Submitted file'}</Text>
      {url ? <Button title="Open file" variant="secondary" onPress={() => open(url)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 14, fontFamily: fonts.bold, marginBottom: 2 },
  body: { color: colors.text, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium },
  remarks: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: spacing.sm + 2, gap: 2 },
  remarksLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold },
});
