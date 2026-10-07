import { fetchSubjectTeachers } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The teachers of the student's class for the current school year (cached per user and year). */
export const useSubjectTeachers = () => useStudentQuery('student-subject-teachers', fetchSubjectTeachers);
