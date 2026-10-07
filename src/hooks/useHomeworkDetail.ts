import { fetchHomeworkDetail } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/**
 * One homework in full. Only mounted while a row is expanded (the caller renders the component that calls this
 * only then), so collapsed rows make no request. The cache key carries the homework id.
 */
export const useHomeworkDetail = (id: string) => useStudentQuery('student-homework-detail', () => fetchHomeworkDetail(id), [id], 60_000);
