import { fetchExamSchedule } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's published exam schedules for the current school year (cached per user and year). */
export const useExamSchedule = () => useStudentQuery('student-exam-schedule', fetchExamSchedule);
