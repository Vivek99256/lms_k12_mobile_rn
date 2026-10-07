import { fetchDiscussion, fetchMyDiscussions } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's own discussions (always `mine=1`; cached per user and year, cleared on sign-out). */
export const useMyDiscussions = () => useStudentQuery('student-my-discussions', () => fetchMyDiscussions());

/** One of the student's own discussions with its conversation. Only called with a digit id taken from the student's own list. */
export const useDiscussion = (id: string) => useStudentQuery('student-discussion', () => fetchDiscussion(id), [id]);
