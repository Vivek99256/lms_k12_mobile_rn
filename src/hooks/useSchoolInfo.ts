import { fetchGallery, fetchSchoolDetail } from '../api/student';
import { GalleryKind } from '../screens/student/galleryModel';
import { useStudentQuery } from './useStudentQuery';

/** One school-information page (cached per user, year and page). Only called with a known action text. */
export const useSchoolInfo = (action: string) => useStudentQuery('student-school-info', () => fetchSchoolDetail(action), [action]);

/** The student's class albums of one kind (cached per user, year and kind). Metadata only - no image is ever fetched by the app. */
export const useGallery = (kind: GalleryKind) => useStudentQuery('student-gallery', () => fetchGallery(kind), [kind]);
