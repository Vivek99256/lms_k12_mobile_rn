import { useQuery } from '@tanstack/react-query';
import {
  fetchCertificates,
  fetchConsents,
  fetchDiscipline,
  fetchHealthRecords,
  fetchHeightWeight,
  fetchInfirmaryRecords,
  fetchTransport,
  fetchVaccinations,
} from '../api/student';
import { useAuthStore } from '../auth/authStore';

/**
 * One read per record type for the signed-in student (S9). These are children's health records, so they are held in
 * memory only AND only while the screen that shows them is mounted: `gcTime: 0` drops the data as soon as the last
 * screen using it unmounts (leaving the screen and coming back fetches again). Nothing is persisted or logged; the key
 * carries the user id and year and the whole query cache is also cleared on sign-out.
 */
function useRecordQuery<T>(name: string, fetcher: () => Promise<T>) {
  const user = useAuthStore((s) => s.user);
  const enabled = !!user && user.isStudent && !!user.syear?.trim();
  return useQuery({
    queryKey: [name, user?.id, user?.syear],
    queryFn: fetcher,
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

export const useHeightWeight = () => useRecordQuery('student-height-weight', fetchHeightWeight);
export const useVaccinations = () => useRecordQuery('student-vaccinations', fetchVaccinations);
export const useHealthRecords = () => useRecordQuery('student-health-records', fetchHealthRecords);
export const useInfirmaryRecords = () => useRecordQuery('student-infirmary-records', fetchInfirmaryRecords);
export const useConsents = () => useRecordQuery('student-consents', fetchConsents);
export const useTransport = () => useRecordQuery('student-transport', fetchTransport);
export const useCertificates = () => useRecordQuery('student-certificates', fetchCertificates);
export const useDiscipline = () => useRecordQuery('student-discipline', fetchDiscipline);
