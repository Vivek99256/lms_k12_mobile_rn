import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchStudentAttendance } from '../api/student';
import { useAuthStore } from '../auth/authStore';
import { buildDayMap, DayMap } from '../screens/student/attendanceModel';

/**
 * The signed-in student's attendance. Only runs for a student session with a school year: the key holds
 * the user id and year, and the whole query cache is cleared on sign-out (App.tsx), so one user's data
 * is never shown to the next.
 */
export function useStudentAttendance() {
  const user = useAuthStore((s) => s.user);
  const enabled = !!user && user.isStudent && !!user.syear?.trim();
  const query = useQuery({
    queryKey: ['student-attendance', user?.id, user?.syear],
    queryFn: fetchStudentAttendance,
    enabled,
    staleTime: 5 * 60_000,
  });
  const dayMap: DayMap | null = useMemo(() => (query.data ? buildDayMap(query.data) : null), [query.data]);
  return { ...query, dayMap };
}
