import { useMemo } from 'react';
import { fetchStudentCalendar } from '../api/student';
import { buildCalendarMap } from '../screens/student/calendarModel';
import { useStudentQuery } from './useStudentQuery';

/** Academic calendar rows (all event types, or only holidays) and the per-day map built from them. */
export function useStudentCalendar(action?: 'holiday') {
  const query = useStudentQuery('student-calendar', () => fetchStudentCalendar(action), [action ?? 'all']);
  const dayMap = useMemo(() => (query.data ? buildCalendarMap(query.data) : null), [query.data]);
  return { ...query, dayMap };
}
