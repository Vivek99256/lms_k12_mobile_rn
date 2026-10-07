import { useQuery } from '@tanstack/react-query';
import { fetchOwnProfile } from '../api/profile';
import { useAuthStore } from '../auth/authStore';
import { DetailsResult, detailsFrom } from '../screens/profile/profileModel';

export const OWN_PROFILE_KEY = ['own-profile-details'] as const;

/**
 * The signed-in user's own details, loaded only while the "My details" card is mounted (i.e. after the user taps
 * "Show my details"). The identity cross-check runs INSIDE the query function, so the raw server record is never stored:
 * the cache only ever holds the approved display rows of a provably-own record, or a bare "mismatch". `gcTime: 0`
 * drops even that as soon as the card goes away; nothing is persisted or logged; no retry on failure.
 */
export function useMyDetails() {
  const id = useAuthStore((s) => s.user?.id);
  return useQuery<DetailsResult>({
    queryKey: [...OWN_PROFILE_KEY, id],
    queryFn: async () => {
      const profile = await fetchOwnProfile();
      const user = useAuthStore.getState().user;
      return user ? detailsFrom(profile, { name: user.name, email: user.email, isStudent: user.isStudent }) : { kind: 'mismatch' };
    },
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}
