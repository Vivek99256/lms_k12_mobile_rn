import { CircularKind, fetchCirculars } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** Circulars or events for the signed-in student; each kind is cached separately. */
export const useCirculars = (kind: CircularKind) => useStudentQuery('student-circulars', () => fetchCirculars(kind), [kind]);
