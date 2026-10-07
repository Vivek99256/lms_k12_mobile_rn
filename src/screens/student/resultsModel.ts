import { ResultFile } from '../../api/student';
import { safeAttachmentUrl } from './circularModel';

export type ResultFileState = 'ready' | 'none' | 'unsafe';

export interface ResultRow {
  key: string;
  term: string;
  state: ResultFileState;
  /** Validated link; only when state is 'ready'. */
  url: string | null;
}

/** Row id order: plain numbers ascending, then anything else in the server's order. */
const idRank = (id: string): number => (/^\d+$/.test(id.trim()) ? Number(id) : Number.POSITIVE_INFINITY);

/**
 * One row per term, nothing hidden. Order: row id ascending (the order the school created them; the server's
 * GROUP BY order is undefined), ties and non-numeric ids keep the server order. Identical rows (same term and
 * file) collapse to one. A missing term name shows as "Term". The link is validated here (F1 host allow-list).
 */
export function resultRows(files: ResultFile[]): ResultRow[] {
  const seen = new Set<string>();
  const unique: { f: ResultFile; at: number }[] = [];
  files.forEach((f, at) => {
    const k = `${f.term.trim().toLowerCase()}|${f.file.trim()}`;
    if (seen.has(k)) return;
    seen.add(k);
    unique.push({ f, at });
  });
  unique.sort((a, b) => idRank(a.f.id) - idRank(b.f.id) || a.at - b.at);
  return unique.map(({ f, at }) => {
    const raw = f.file.trim();
    const url = raw ? safeAttachmentUrl(raw) : null;
    const state: ResultFileState = !raw ? 'none' : url ? 'ready' : 'unsafe';
    return { key: `${f.id || 'row'}-${at}`, term: f.term.trim() || 'Term', state, url };
  });
}

/**
 * True when a Result tile points at studentResultPDFAPI (unauthenticated without type=API, injectable, deletes a
 * shared folder). The app never calls it; the screen shows "not available" for that tile instead.
 */
export function isBlockedResultTile(api: string | null | undefined): boolean {
  if (!api) return false;
  const path = api.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  const last = path.slice(path.lastIndexOf('/') + 1);
  return last.toLowerCase() === 'studentresultpdfapi';
}
