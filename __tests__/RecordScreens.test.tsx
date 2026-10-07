import { fireEvent, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { RecordUnavailableScreen } from '../src/screens/student/RecordUnavailableScreen';
import {
  CertificatesScreen,
  ConsentScreen,
  HealthDetailsScreen,
  HeightWeightScreen,
  InfirmaryScreen,
  TransportScreen,
  VaccinationScreen,
} from '../src/screens/student/RecordScreens';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({
  ...jest.requireActual('../src/api/student'),
  fetchHeightWeight: jest.fn(),
  fetchVaccinations: jest.fn(),
  fetchHealthRecords: jest.fn(),
  fetchInfirmaryRecords: jest.fn(),
  fetchConsents: jest.fn(),
  fetchTransport: jest.fn(),
  fetchCertificates: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('../src/api/student') as Record<string, jest.Mock>;

const FILE = 'https://erp.triz.co.in/storage/frontdesk/report.pdf';
const PLACEHOLDER = 'https://erp.triz.co.in/storage/frontdesk/noimages.png';

interface Case {
  name: string;
  Screen: (p: { tile: ReturnType<typeof tile> }) => React.ReactElement;
  fetcher: string;
  caption: string;
  empty: string;
  /** Two sample records: the first one is the newer. */
  rows: Record<string, unknown>[];
  firstTitle: string;
  secondTitle: string;
}

const CASES: Case[] = [
  {
    name: 'Height & Weight',
    Screen: HeightWeightScreen,
    fetcher: 'fetchHeightWeight',
    caption: 'School year 2026',
    empty: 'No height & weight records for school year 2026',
    rows: [
      { date: '01-01-2025', height: '140', weight: '35', doctorName: 'Dr Old', doctorContact: '', },
      { date: '01-03-2026', height: '150', weight: '40', doctorName: 'Dr New', doctorContact: '9876543210' },
    ],
    firstTitle: '1 Mar 2026',
    secondTitle: '1 Jan 2025',
  },
  {
    name: 'Vaccination',
    Screen: VaccinationScreen,
    fetcher: 'fetchVaccinations',
    caption: 'School year 2026',
    empty: 'No vaccination records for school year 2026',
    rows: [
      { vaccinationType: 'Old shot', note: '', date: '01-01-2025', doctorName: '', doctorContact: '' },
      { vaccinationType: 'New shot', note: 'Dose 2', date: '01-03-2026', doctorName: 'Dr A', doctorContact: '' },
    ],
    firstTitle: 'New shot',
    secondTitle: 'Old shot',
  },
  {
    name: 'Health Details',
    Screen: HealthDetailsScreen,
    fetcher: 'fetchHealthRecords',
    caption: 'All years',
    empty: 'No health records',
    rows: [
      { date: '01-01-2025', remarks: 'old remarks', doctorName: '', doctorContact: '', file: PLACEHOLDER },
      { date: '01-03-2026', remarks: 'new remarks', doctorName: 'Dr A', doctorContact: '', file: FILE },
    ],
    firstTitle: '1 Mar 2026',
    secondTitle: '1 Jan 2025',
  },
  {
    name: 'Infirmary',
    Screen: InfirmaryScreen,
    fetcher: 'fetchInfirmaryRecords',
    caption: 'School year 2026',
    empty: 'No infirmary records for school year 2026',
    rows: [
      { complaint: 'Old complaint', date: '01-01-2025', doctorName: '', doctorContact: '', caseNo: '', symptoms: '', disease: '', treatments: '', closeDate: '02-01-2025', healthCenter: '' },
      { complaint: 'New complaint', date: '01-03-2026', doctorName: '', doctorContact: '', caseNo: '', symptoms: 'Cough', disease: '', treatments: 'Rest', closeDate: '', healthCenter: '' },
    ],
    firstTitle: 'New complaint',
    secondTitle: 'Old complaint',
  },
  {
    name: 'Consent',
    Screen: ConsentScreen,
    fetcher: 'fetchConsents',
    caption: 'School year 2026',
    empty: 'No consents for school year 2026',
    rows: [
      { title: 'Old consent', date: '01-01-2025', accountableStatus: '', status: 'Approved', amount: '' },
      { title: 'New consent', date: '01-03-2026', accountableStatus: 'Parent', status: '', amount: '1500' },
    ],
    firstTitle: 'New consent',
    secondTitle: 'Old consent',
  },
  {
    name: 'Transport',
    Screen: TransportScreen,
    fetcher: 'fetchTransport',
    caption: 'School year 2026',
    empty: 'No transport details for school year 2026',
    rows: [
      { fromShift: 'Morning', fromBus: 'Bus 4', fromStop: 'Park Rd', toShift: 'Evening', toBus: 'Bus 5', toStop: 'Mall Rd', gpsLink: '' },
    ],
    firstTitle: 'Transport',
    secondTitle: 'Transport',
  },
  {
    name: 'Certificates',
    Screen: CertificatesScreen,
    fetcher: 'fetchCertificates',
    caption: 'School year 2026',
    empty: 'No certificates for school year 2026',
    rows: [
      { type: 'Old certificate', number: '1', html: '<p>old</p>', createdAt: '2025-04-01 10:00:00' },
      { type: 'New certificate', number: '2', html: '<p>new</p>', createdAt: '2026-04-01 10:00:00' },
    ],
    firstTitle: 'New certificate',
    secondTitle: 'Old certificate',
  },
];

let client = makeClient();
const ui = (Screen: Case['Screen'], tileApi: string | null = null) => renderWith(client, <Screen tile={{ ...tile('x'), api: tileApi }} />);
let openURL: jest.SpyInstance;
let consoleSpies: jest.SpyInstance[];

beforeEach(() => {
  client = makeClient();
  for (const k of Object.keys(api)) if (k.startsWith('fetch') && jest.isMockFunction(api[k])) api[k].mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  consoleSpies = (['log', 'info', 'warn', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  signIn();
});
afterEach(() => {
  openURL.mockRestore();
  consoleSpies.forEach((s) => s.mockRestore());
});

describe.each(CASES)('$name screen', (c) => {
  const fetcher = () => api[c.fetcher];

  it('shows loading, then the records newest first with the caption and the "added by your school" note', async () => {
    fetcher().mockResolvedValue(c.rows);
    await ui(c.Screen);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText(c.caption)).toBeTruthy();
    expect(screen.getByText('Records are added by your school.')).toBeTruthy();
    if (c.firstTitle !== c.secondTitle) {
      const labels = screen.getAllByLabelText(new RegExp(`^(${c.firstTitle}|${c.secondTitle})`)).map((n) => n.props.accessibilityLabel as string);
      expect(labels[0].startsWith(c.firstTitle)).toBe(true);
      expect(labels[1].startsWith(c.secondTitle)).toBe(true);
    } else {
      expect(screen.getByText(c.firstTitle)).toBeTruthy();
    }
    expect(fetcher()).toHaveBeenCalledTimes(1);
  });

  it('is strictly view only: no input, no edit, no share, and only Try again / Show more / Open / Track / View text buttons exist', async () => {
    fetcher().mockResolvedValue(c.rows);
    await ui(c.Screen);
    await screen.findByText(c.caption);
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(screen.queryByDisplayValue(/./)).toBeNull();
    expect(screen.queryByText(/share|export|download|edit|delete|add |submit|save|pay|sign|agree/i)).toBeNull();
    const allowed = /^(Open document|Track bus|View text|Hide text|Show more.*|Try again)$/;
    for (const b of screen.queryAllByRole('button')) {
      const label = b.props.accessibilityLabel ?? '';
      expect(label === '' || allowed.test(label)).toBe(true);
    }
  });

  it('empty list -> an empty state with the note', async () => {
    fetcher().mockResolvedValue([]);
    await ui(c.Screen);
    expect(await screen.findByText(c.empty)).toBeTruthy();
    expect(screen.getByText('Records are added by your school.')).toBeTruthy();
  });

  it('401 shows the session message', async () => {
    fetcher().mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui(c.Screen);
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetcher().mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui(c.Screen);
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetcher().mockResolvedValueOnce(c.rows);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText(c.caption)).toBeTruthy();
    expect(fetcher()).toHaveBeenCalledTimes(2);
  });

  it('"Parameter Missing" is shown with Try again', async () => {
    fetcher().mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui(c.Screen);
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a failed refresh keeps the records and shows the stale banner', async () => {
    fetcher().mockResolvedValueOnce(c.rows);
    await ui(c.Screen);
    await screen.findByText(c.caption);
    fetcher().mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText(c.caption)).toBeTruthy();
  });

  it('guards: no school year / non-student -> message and no request', async () => {
    signIn({ syear: '' });
    const first = await ui(c.Screen);
    expect(screen.getByText('School year not set')).toBeTruthy();
    await first.unmount();
    signIn({ isStudent: false });
    client = makeClient();
    await ui(c.Screen);
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetcher()).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's records", async () => {
    fetcher().mockResolvedValueOnce(c.rows);
    const first = await ui(c.Screen);
    await screen.findByText(c.caption);
    await first.unmount();
    signIn({ id: 456 });
    fetcher().mockResolvedValueOnce([]);
    await ui(c.Screen);
    expect(await screen.findByText(c.empty)).toBeTruthy();
    expect(screen.queryByText(c.firstTitle)).toBeNull();
  });

  it("ignores the tile's stored api: it calls only its own fixed fetcher", async () => {
    fetcher().mockResolvedValue(c.rows);
    await ui(c.Screen, 'https://erp.triz.co.in/add_communicationAPI');
    await screen.findByText(c.caption);
    expect(fetcher()).toHaveBeenCalledTimes(1);
  });

  it('30 at a time with "Show more"', async () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ ...c.rows[c.rows.length - 1], date: '01-03-2026', complaint: `Many ${i}`, title: `Many ${i}`, vaccinationType: `Many ${i}`, type: `Many ${i}` }));
    fetcher().mockResolvedValue(many);
    await ui(c.Screen);
    await screen.findByText('Show more (1 more)');
    await fireEvent.press(screen.getByText('Show more (1 more)'));
    expect(screen.queryByText(/Show more/)).toBeNull();
  });
});

describe('Health Details - documents', () => {
  const row = (file: string) => ({ date: '01-03-2026', remarks: 'r', doctorName: '', doctorContact: '', file });

  it('"noimages.png" is no document: no button and no message', async () => {
    api.fetchHealthRecords.mockResolvedValue([row(PLACEHOLDER)]);
    await ui(HealthDetailsScreen);
    await screen.findByText('All years');
    expect(screen.queryByText('Open document')).toBeNull();
    expect(screen.queryByText(/can't be opened/)).toBeNull();
  });

  it('a real file opens once, re-based, only in the phone viewer', async () => {
    api.fetchHealthRecords.mockResolvedValue([row(FILE)]);
    await ui(HealthDetailsScreen);
    await fireEvent.press(await screen.findByText('Open document'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/frontdesk/report.pdf');
  });

  it('unsafe links have no button and a clear message; nothing is opened', async () => {
    api.fetchHealthRecords.mockResolvedValue([row('https://evil.example/a.pdf'), { ...row('javascript:alert(1)'), remarks: 'r2' }]);
    await ui(HealthDetailsScreen);
    await screen.findByText('All years');
    expect(screen.getAllByText("Document can't be opened from the app")).toHaveLength(2);
    expect(screen.queryByText('Open document')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('an open failure shows an inline notice and the screen stays usable', async () => {
    openURL.mockRejectedValue(new Error('No Activity found'));
    api.fetchHealthRecords.mockResolvedValue([row(FILE)]);
    await ui(HealthDetailsScreen);
    await fireEvent.press(await screen.findByText('Open document'));
    expect(await screen.findByText("Couldn't open the file. Please try again or contact your school.")).toBeTruthy();
    expect(screen.getByText('Open document')).toBeTruthy();
  });

  it('says "All years" (no year filter) even when the school year is set', async () => {
    api.fetchHealthRecords.mockResolvedValue([row(FILE)]);
    await ui(HealthDetailsScreen);
    expect(await screen.findByText('All years')).toBeTruthy();
    expect(screen.queryByText(/School year/)).toBeNull();
  });
});

describe('doctor phone numbers are plain text, never tappable', () => {
  it('Height & Weight shows the number as text with no link or button role and no tel: call', async () => {
    const linking = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    api.fetchHeightWeight.mockResolvedValue([{ date: '01-03-2026', height: '150', weight: '40', doctorName: 'Dr New', doctorContact: '9876543210' }]);
    await ui(HeightWeightScreen);
    const contact = await screen.findByText(/9876543210/);
    expect(contact).toBeTruthy();
    await fireEvent.press(contact);
    expect(openURL).not.toHaveBeenCalled();
    expect(linking).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    linking.mockRestore();
  });

  it('Height & Weight never adds a unit', async () => {
    api.fetchHeightWeight.mockResolvedValue([{ date: '01-03-2026', height: '150', weight: '40', doctorName: '', doctorContact: '' }]);
    await ui(HeightWeightScreen);
    await screen.findByText('School year 2026');
    expect(screen.getByText(/Height: 150$/)).toBeTruthy();
    expect(screen.getByText(/Weight: 40$/)).toBeTruthy();
    expect(screen.queryByText(/\b(cm|kg|lb|inch)\b/i)).toBeNull();
  });
});

describe('Consent', () => {
  it('null status shows Pending; the amount is in rupees; there is no consent action', async () => {
    api.fetchConsents.mockResolvedValue([{ title: 'Trip', date: '01-03-2026', accountableStatus: '', status: '', amount: '1500' }]);
    await ui(ConsentScreen);
    expect(await screen.findByLabelText('Status: Pending')).toBeTruthy();
    expect(screen.getByText(/₹1,500/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/agree|accept|give consent|sign/i)).toBeNull();
  });
});

describe('Transport', () => {
  const base = { fromShift: 'Morning', fromBus: 'Bus 4', fromStop: 'Park Rd', toShift: '', toBus: '', toStop: '', gpsLink: '' };

  it('shows only what the server sent: a missing drop is not invented', async () => {
    api.fetchTransport.mockResolvedValue([base]);
    await ui(TransportScreen);
    expect(await screen.findByText(/Morning · Bus 4 · Park Rd/)).toBeTruthy();
    expect(screen.queryByText(/Drop/)).toBeNull();
  });

  it('Track bus opens a plain https link once; unsafe tracking links have no button', async () => {
    api.fetchTransport.mockResolvedValue([{ ...base, gpsLink: 'https://gps.example.com/track?id=4' }]);
    await ui(TransportScreen);
    await fireEvent.press(await screen.findByText('Track bus'));
    expect(openURL).toHaveBeenCalledWith('https://gps.example.com/track?id=4');
  });

  it('an unsafe tracking link shows a message and no button', async () => {
    api.fetchTransport.mockResolvedValue([{ ...base, gpsLink: 'javascript:alert(1)' }]);
    await ui(TransportScreen);
    expect(await screen.findByText("Tracking link can't be opened from the app")).toBeTruthy();
    expect(screen.queryByText('Track bus')).toBeNull();
  });
});

describe('Certificates', () => {
  it('shows the text version behind "View text" with the approved notice; HTML is never markup', async () => {
    api.fetchCertificates.mockResolvedValue([{ type: 'Bonafide', number: '12', html: '<div>Hello <b>World</b></div><script>alert(1)</script>', createdAt: '2026-04-01 10:00:00' }]);
    await ui(CertificatesScreen);
    await screen.findByText('Bonafide');
    expect(screen.queryByText('Hello World')).toBeNull();
    await fireEvent.press(screen.getByText('View text'));
    expect(await screen.findByText('Text version. For the official certificate, ask your school.')).toBeTruthy();
    expect(screen.getByText('Hello World')).toBeTruthy();
    expect(screen.queryByText(/script|alert|<b>/)).toBeNull();
    await fireEvent.press(screen.getByText('Hide text'));
    expect(screen.queryByText('Hello World')).toBeNull();
  });

  it('a certificate with no text has no View text button', async () => {
    api.fetchCertificates.mockResolvedValue([{ type: 'Empty', number: '', html: '<div></div>', createdAt: '' }]);
    await ui(CertificatesScreen);
    await screen.findByText('Empty');
    expect(screen.queryByText('View text')).toBeNull();
  });
});

describe('sensitive data: memory only, never logged or persisted', () => {
  it('rendering and opening records writes nothing to storage and nothing to the console', async () => {
    const SECRET = 'SENSITIVE-DIAGNOSIS-TEXT';
    api.fetchInfirmaryRecords.mockResolvedValue([{ complaint: SECRET, date: '01-03-2026', doctorName: '', doctorContact: '9990001111', caseNo: '', symptoms: SECRET, disease: SECRET, treatments: SECRET, closeDate: '', healthCenter: '' }]);
    api.fetchHealthRecords.mockResolvedValue([{ date: '01-03-2026', remarks: SECRET, doctorName: '', doctorContact: '', file: FILE }]);
    const first = await ui(InfirmaryScreen);
    await screen.findByText(SECRET);
    await first.unmount();
    const second = await ui(HealthDetailsScreen);
    await fireEvent.press(await screen.findByText('Open document'));
    await second.unmount();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    for (const spy of consoleSpies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/SENSITIVE|9990001111/);
    }
  });
});

describe('records are dropped from memory when the screen closes', () => {
  it.each(CASES)('$name: no query data is kept after the screen unmounts', async (c) => {
    api[c.fetcher].mockResolvedValue(c.rows);
    const r = await ui(c.Screen);
    await screen.findByText(c.caption);
    expect(client.getQueryCache().getAll().length).toBe(1);
    await r.unmount();
    await new Promise((res) => setTimeout(res, 20));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('Hostel and Achievement Certificate tiles', () => {
  it("show \"This isn't available in the app yet.\" and make no request of any kind", async () => {
    const fetchSpy = jest.fn();
    (global as { fetch: unknown }).fetch = fetchSpy;
    for (const screenName of ['student_hostel', 'achievement_certificate']) {
      const r = await renderWith(makeClient(), <RecordUnavailableScreen tile={{ ...tile(screenName), api: 'https://erp.triz.co.in/studentHostelAllocationAPI' }} />);
      expect(screen.getByText("This isn't available in the app yet.")).toBeTruthy();
      expect(screen.getByText('Please ask your school.')).toBeTruthy();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      await r.unmount();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const k of Object.keys(api)) if (jest.isMockFunction(api[k])) expect(api[k]).not.toHaveBeenCalled();
  });
});
