import {
  CertificateRecord,
  ConsentRecord,
  HealthRecord,
  HeightWeightRecord,
  InfirmaryRecord,
  TransportRecord,
  VaccinationRecord,
} from '../../api/student';
import { PillTone } from '../../components/StatusPill';
import { displayDate } from '../../utils/dates';
import { isSafeHttpUrl } from '../../utils/links';
import { formatInr } from '../../utils/money';
import { stripHtml } from '../../utils/text';
import { safeAttachmentUrl } from './circularModel';
import { leaveStatus, applySortKey } from './leaveModel';
import { cleanText } from './listHelpers';

export const RECORDS_NOTE = 'Records are added by your school.';
export const CERTIFICATE_NOTICE = 'Text version. For the official certificate, ask your school.';

export interface RecordField {
  label: string;
  value: string;
}

export type LinkState = 'ready' | 'none' | 'unsafe';

export interface RecordLink {
  /** Button text, e.g. "Open document". */
  label: string;
  state: LinkState;
  url: string | null;
  /** Shown instead of a button when the link fails the check. */
  unsafeMessage: string;
}

export interface RecordRow {
  key: string;
  title: string;
  /** Display date, '' when none. */
  date: string;
  fields: RecordField[];
  status?: { label: string; tone: PillTone };
  link?: RecordLink;
  /** Certificate text, behind a "View text" button. */
  text?: string;
}

/** Everything is plain text; empty / "null" values are left out of `fields`, never replaced by made-up ones. */
const field = (label: string, v: string): RecordField[] => {
  const value = cleanText(v);
  return value ? [{ label, value }] : [];
};

/** Doctor name and contact, as plain text (the number is never a link). */
const doctor = (name: string, contact: string): RecordField[] => [...field('Doctor', name), ...field('Doctor contact', contact)];

interface Keyed<T> {
  item: T;
  at: number;
  k: string | null;
}

/** Newest first by the record's date; unreadable dates last; ties keep the server order. Nothing is dropped. */
function newestFirst<T>(items: T[], dateOf: (t: T) => string): Keyed<T>[] {
  const keyed = items.map((item, at) => ({ item, at, k: applySortKey(dateOf(item)) }));
  keyed.sort((a, b) => {
    if (a.k !== null && b.k !== null) return a.k < b.k ? 1 : a.k > b.k ? -1 : a.at - b.at;
    if (a.k !== null) return -1;
    if (b.k !== null) return 1;
    return a.at - b.at;
  });
  return keyed;
}

export function heightWeightRows(items: HeightWeightRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.date).map(({ item: r, at }) => ({
    key: `${at}`,
    title: displayDate(r.date) || 'Measurement',
    date: '',
    // As recorded: no unit is added.
    fields: [...field('Height', r.height), ...field('Weight', r.weight), ...doctor(r.doctorName, r.doctorContact)],
  }));
}

export function vaccinationRows(items: VaccinationRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.date).map(({ item: r, at }) => ({
    key: `${at}`,
    title: cleanText(r.vaccinationType) || 'Vaccination',
    date: displayDate(r.date),
    fields: [...field('Note', r.note), ...doctor(r.doctorName, r.doctorContact)],
  }));
}

/** The server always sends a URL for `file`; the `noimages.png` placeholder (any case, any query) means there is no document. */
export const isPlaceholderFile = (url: string): boolean => /(^|\/)noimages\.png$/i.test(url.trim().split(/[?#]/)[0]);

export function fileLink(raw: string, label: string, unsafeMessage: string): RecordLink {
  const s = raw.trim();
  if (!s || isPlaceholderFile(s)) return { label, state: 'none', url: null, unsafeMessage };
  const url = safeAttachmentUrl(s);
  return { label, state: url ? 'ready' : 'unsafe', url, unsafeMessage };
}

export function healthRows(items: HealthRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.date).map(({ item: r, at }) => ({
    key: `${at}`,
    title: displayDate(r.date) || 'Health record',
    date: '',
    fields: [...field('Remarks', r.remarks), ...doctor(r.doctorName, r.doctorContact)],
    link: fileLink(r.file, 'Open document', "Document can't be opened from the app"),
  }));
}

export function infirmaryRows(items: InfirmaryRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.date).map(({ item: r, at }) => {
    const closed = displayDate(r.closeDate);
    return {
      key: `${at}`,
      title: cleanText(r.complaint) || 'Infirmary visit',
      date: displayDate(r.date),
      fields: [
        ...field('Symptoms', r.symptoms),
        ...field('Disease', r.disease),
        ...field('Treatment', r.treatments),
        ...field('Health centre', r.healthCenter),
        ...field('Case no.', r.caseNo),
        ...(closed ? [{ label: 'Closed on', value: closed }] : []),
        ...doctor(r.doctorName, r.doctorContact),
      ],
      status: closed ? { label: 'Closed', tone: 'neutral' as PillTone } : { label: 'Open', tone: 'warning' as PillTone },
    };
  });
}

/** A numeric amount is shown in rupees; anything else is shown exactly as the school sent it. */
export function consentAmount(raw: string): string {
  const s = cleanText(raw);
  if (!s) return '';
  return /^-?\d+(\.\d+)?$/.test(s) ? formatInr(Number(s)) : s;
}

export function consentRows(items: ConsentRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.date).map(({ item: r, at }) => ({
    key: `${at}`,
    title: cleanText(r.title) || 'Consent',
    date: displayDate(r.date),
    // The server sends NULL for a pending consent; the school's own query meant "Pending".
    status: leaveStatus(r.status),
    fields: [...field('Amount', consentAmount(r.amount)), ...field('Accountable', r.accountableStatus)],
  }));
}

/** Pick-up / drop lines are built only from what the server sent; a missing direction is simply not shown. */
const route = (shift: string, bus: string, stop: string): string => [shift, bus, stop].map(cleanText).filter(Boolean).join(' · ');

export function trackingLink(raw: string): RecordLink {
  const s = raw.trim();
  const base = { label: 'Track bus', unsafeMessage: "Tracking link can't be opened from the app" };
  if (!s) return { ...base, state: 'none', url: null };
  return isSafeHttpUrl(s) ? { ...base, state: 'ready', url: s } : { ...base, state: 'unsafe', url: null };
}

export function transportRows(items: TransportRecord[]): RecordRow[] {
  return items.map((r, at) => ({
    key: `${at}`,
    title: 'Transport',
    date: '',
    fields: [...field('Pick-up', route(r.fromShift, r.fromBus, r.fromStop)), ...field('Drop', route(r.toShift, r.toBus, r.toStop))],
    link: trackingLink(r.gpsLink),
  }));
}

export function certificateRows(items: CertificateRecord[]): RecordRow[] {
  return newestFirst(items, (r) => r.createdAt).map(({ item: r, at }) => {
    const body = stripHtml(r.html);
    return {
      key: `${at}`,
      title: cleanText(r.type) || 'Certificate',
      date: displayDate(r.createdAt),
      fields: field('Number', r.number),
      text: body || undefined,
    };
  });
}
