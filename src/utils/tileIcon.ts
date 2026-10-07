import { candy } from '../config/theme';

// First match wins. The backend's `icon` field is an image reference, so an emoji is chosen
// from the tile's own title; unmatched titles get a sparkle.
const RULES: [RegExp, string][] = [
  [/attend/i, '📅'],
  [/home ?work|assign/i, '📚'],
  [/fee|payment|receipt|fine/i, '💰'],
  [/time ?table|schedule|period/i, '⏰'],
  [/leave/i, '🏖️'],
  [/exam|result|mark|grade/i, '🏆'],
  [/report/i, '📊'],
  [/circular|notice|announce|message|notification|chat/i, '📣'],
  [/gallery|photo|video|media/i, '🖼️'],
  [/event|calendar|holiday/i, '🎉'],
  [/quiz|test|question|assess/i, '🧠'],
  [/lms|course|lesson|learn|content/i, '🎓'],
  [/library|book/i, '📖'],
  [/admission|enquiry|registration/i, '📝'],
  [/student/i, '🧑‍🎓'],
  [/staff|teacher|hrms|employee/i, '👩‍🏫'],
  [/profile/i, '🙂'],
  [/transport|bus|route/i, '🚌'],
  [/diary|note/i, '📒'],
  [/setting|config/i, '⚙️'],
];

export function tileEmoji(title: string): string {
  return RULES.find(([re]) => re.test(title))?.[1] ?? '✨';
}

/** Stable candy colour for the n-th item. */
export function tintFor(index: number) {
  return candy[index % candy.length];
}
