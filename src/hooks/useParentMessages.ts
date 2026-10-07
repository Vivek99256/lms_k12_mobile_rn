import { fetchParentMessages } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's own messages to school and the replies, for the current school year (cached per user and year). */
export const useParentMessages = () => useStudentQuery('student-parent-messages', fetchParentMessages);
