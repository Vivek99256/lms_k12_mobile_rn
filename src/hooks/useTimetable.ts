import { fetchTimetable } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's timetable for the current school year (cached per user and year, fresh for five minutes). */
export const useTimetable = () => useStudentQuery('student-timetable', fetchTimetable);
