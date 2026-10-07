import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';

/**
 * One cached read for the signed-in student. Runs only for a student session that has a school year
 * (the screens show their own message otherwise). The key holds the user id and year, and the whole
 * query cache is cleared on sign-out (App.tsx), so one user's data is never shown to the next.
 */
export function useStudentQuery<T>(name: string, fetcher: () => Promise<T>, extraKey: readonly unknown[] = [], staleTimeMs = 5 * 60_000) {
  const user = useAuthStore((s) => s.user);
  const enabled = !!user && user.isStudent && !!user.syear?.trim();
  return useQuery({
    queryKey: [name, user?.id, user?.syear, ...extraKey],
    queryFn: fetcher,
    enabled,
    staleTime: staleTimeMs,
  });
}
