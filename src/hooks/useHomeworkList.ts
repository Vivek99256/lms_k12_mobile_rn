import { fetchHomeworkList } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's homework (token-bound `my-submissions`). Cached per user and year; fresh for one minute. */
export const useHomeworkList = () => useStudentQuery('student-homework', fetchHomeworkList, [], 60_000);
