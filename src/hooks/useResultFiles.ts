import { fetchResultFiles } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's result-file list for the current school year (cached per user and year). */
export const useResultFiles = () => useStudentQuery('student-result-files', fetchResultFiles);
