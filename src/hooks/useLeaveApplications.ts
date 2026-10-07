import { fetchLeaveApplications } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's own leave applications for the current school year (cached per user and year). */
export const useLeaveApplications = () => useStudentQuery('student-leave-applications', fetchLeaveApplications);
