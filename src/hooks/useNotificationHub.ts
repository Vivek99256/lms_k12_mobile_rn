import { fetchNotifications } from '../api/student';
import { useStudentQuery } from './useStudentQuery';

/** The student's notifications (newest first, as the server orders them). Fresh for one minute. */
export const useNotificationHub = () => useStudentQuery('student-notifications', fetchNotifications, [], 60_000);
