import { useQuery } from '@tanstack/react-query';
import { fetchFeeSummary } from '../api/student';
import { useAuthStore } from '../auth/authStore';

/**
 * The student's whole-year fee summary (cached per user and year; cleared on sign-out like the other student reads).
 * Never retried automatically: the endpoint has a known backend defect (S6 doc §9), and the student can retry by hand.
 */
export function useFeeSummary() {
  const user = useAuthStore((s) => s.user);
  const enabled = !!user && user.isStudent && !!user.syear?.trim();
  return useQuery({
    queryKey: ['student-fee-summary', user?.id, user?.syear],
    queryFn: fetchFeeSummary,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
