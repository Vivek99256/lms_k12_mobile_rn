import { SubjectTeacher } from '../../api/student';
import { cleanText } from './listHelpers';

export interface TeacherRow {
  key: string;
  name: string;
  /** Separate subject names; empty when none were sent. */
  subjects: string[];
}

/** Server order (by teacher name). The subject list is split on commas, trimmed, de-duplicated; nothing else is shown. */
export function teacherRows(teachers: SubjectTeacher[]): TeacherRow[] {
  return teachers.map((t, i) => {
    const seen = new Set<string>();
    const subjects: string[] = [];
    for (const piece of t.subjects.split(',')) {
      const s = cleanText(piece);
      const k = s.toLowerCase();
      if (s && !seen.has(k)) {
        seen.add(k);
        subjects.push(s);
      }
    }
    return { key: `${i}`, name: cleanText(t.name) || 'Teacher', subjects };
  });
}
