import { fetchStudentDashboard } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student dashboard summary. Fresh for one minute so Home feels current after returning to it. */
export const useStudentDashboard = () => useStudentQuery('student-dashboard', fetchStudentDashboard, [], 60_000);
