import { SchoolDetailRow } from '../../api/student';
import { stripHtml } from '../../utils/text';

/**
 * The fixed `action` text each school-information tile sends (Flutter student_screens.dart:57-66). The server compares it
 * with the stored page type, so the app never builds it from the tile's stored fields. A screen name that is not here has
 * no page and makes no request.
 */
export const SCHOOL_INFO_ACTIONS: Record<string, string> = {
  about_us: 'About Us',
  principal_desk: 'Principal Desk',
  school_information: 'School Information',
  achievement: 'Achievement',
  school_timing: 'School Timing',
  rules: 'Rules',
  facility: 'Facility',
  acadamic_activity: 'Academic Activity',
  reach_us: 'Reach Us',
};

export const schoolInfoAction = (screenName: string | null | undefined): string | null =>
  screenName && Object.prototype.hasOwnProperty.call(SCHOOL_INFO_ACTIONS, screenName) ? SCHOOL_INFO_ACTIONS[screenName] : null;

export interface SchoolInfoPart {
  key: string;
  /** Plain text made from the school's HTML; never empty. */
  text: string;
}

/**
 * Each row's HTML becomes plain text (scripts/styles removed, tags dropped, entities decoded after stripping). Rows
 * with no text are left out - nothing is invented to fill them - and the rest keep the server's order.
 */
export function schoolInfoParts(rows: SchoolDetailRow[]): SchoolInfoPart[] {
  const parts: SchoolInfoPart[] = [];
  rows.forEach((r, i) => {
    const text = stripHtml(r.content);
    if (text) parts.push({ key: `${i}`, text });
  });
  return parts;
}
