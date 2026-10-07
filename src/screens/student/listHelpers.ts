/** Rows shown at a time on the S7 lists (client-side "Show more", as the homework list). */
export const LIST_PAGE_SIZE = 30;

/** Reply / name text from the server: trimmed, and the literal string "null" (a NULL column) counts as nothing. */
export function cleanText(v: string): string {
  const s = v.trim();
  return /^(null|undefined)$/i.test(s) ? '' : s;
}
