import {
  certificateRows,
  consentAmount,
  consentRows,
  fileLink,
  healthRows,
  heightWeightRows,
  infirmaryRows,
  isPlaceholderFile,
  trackingLink,
  transportRows,
  vaccinationRows,
} from '../src/screens/student/recordsModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const FILE = 'https://erp.triz.co.in/storage/frontdesk/report.pdf';
const PLACEHOLDER = 'https://erp.triz.co.in/storage/frontdesk/noimages.png';

const hw = (date: string, height = '150', weight = '40', doctorName = '', doctorContact = '') => ({ date, height, weight, doctorName, doctorContact });

describe('height & weight', () => {
  it('newest first (server sends oldest first), unreadable dates last, ties keep the server order, no mutation', () => {
    const input = [hw('01-01-2026'), hw('15-03-2026'), hw(''), hw('15-03-2026', '151'), hw('bad')];
    const rows = heightWeightRows(input);
    expect(rows.map((r) => r.fields[0].value)).toEqual(['150', '151', '150', '150', '150']);
    expect(rows.map((r) => r.title)).toEqual(['15 Mar 2026', '15 Mar 2026', '1 Jan 2026', 'Measurement', 'bad']);
    expect(input[0].date).toBe('01-01-2026');
    expect(new Set(rows.map((r) => r.key)).size).toBe(5);
  });
  it('shows the values exactly as recorded - no unit is ever added', () => {
    const [r] = heightWeightRows([hw('01-01-2026', '152.5', '41')]);
    expect(r.fields).toEqual([{ label: 'Height', value: '152.5' }, { label: 'Weight', value: '41' }]);
    expect(JSON.stringify(r)).not.toMatch(/\b(cm|kg|m|lb|inch|feet)\b/i);
  });
  it('empty and "null" values are left out but the row stays; doctor and contact are plain text fields', () => {
    const [r] = heightWeightRows([hw('01-01-2026', '', 'null', 'Dr Rao', '9876543210')]);
    expect(r.fields).toEqual([{ label: 'Doctor', value: 'Dr Rao' }, { label: 'Doctor contact', value: '9876543210' }]);
  });
  it('no records -> no rows', () => expect(heightWeightRows([])).toEqual([]));
});

describe('vaccination', () => {
  it('newest first; title is the vaccine, falls back to "Vaccination"; note and doctor shown', () => {
    const rows = vaccinationRows([
      { vaccinationType: 'MMR', note: 'Dose 1', date: '01-02-2025', doctorName: 'Dr A', doctorContact: '' },
      { vaccinationType: '', note: '', date: '01-02-2026', doctorName: '', doctorContact: '' },
    ]);
    expect(rows.map((r) => r.title)).toEqual(['Vaccination', 'MMR']);
    expect(rows[1].fields).toEqual([{ label: 'Note', value: 'Dose 1' }, { label: 'Doctor', value: 'Dr A' }]);
    expect(rows[1].date).toBe('1 Feb 2025');
  });
});

describe('health details - documents', () => {
  it('noimages.png in any case / with a query string means NO document', () => {
    for (const u of [PLACEHOLDER, PLACEHOLDER.toUpperCase(), `${PLACEHOLDER}?v=2`, 'https://x/y/NoImages.PNG', '  ' + PLACEHOLDER + '  ']) {
      expect(isPlaceholderFile(u)).toBe(true);
      expect(fileLink(u, 'Open document', 'm')).toMatchObject({ state: 'none', url: null });
    }
    expect(isPlaceholderFile('https://x/storage/frontdesk/mynoimages.png.pdf')).toBe(false);
    expect(isPlaceholderFile(FILE)).toBe(false);
  });
  it('a real file is ready and re-based onto the API host', () => {
    expect(fileLink(FILE, 'Open document', 'm')).toMatchObject({ state: 'ready', url: 'https://dev.triz.co.in/storage/frontdesk/report.pdf' });
  });
  it('empty -> none; unsafe links -> unsafe with the message, row kept', () => {
    expect(fileLink('', 'Open document', 'm').state).toBe('none');
    for (const bad of ['https://evil.example/a.pdf', 'https://erp.triz.co.in.evil.com/a.pdf', 'https://erp.triz.co.in@evil.example/a.pdf', 'javascript:alert(1)', 'file:///etc/passwd', 'intent://x', 'a.pdf']) {
      const rows = healthRows([{ date: '01-01-2026', remarks: 'r', doctorName: '', doctorContact: '', file: bad }]);
      expect(rows).toHaveLength(1);
      expect(rows[0].link).toMatchObject({ state: 'unsafe', url: null, unsafeMessage: "Document can't be opened from the app" });
    }
  });
  it('newest first; remarks and doctor shown as text', () => {
    const rows = healthRows([
      { date: '01-01-2025', remarks: 'old', doctorName: 'Dr A', doctorContact: '123', file: PLACEHOLDER },
      { date: '01-01-2026', remarks: 'new', doctorName: '', doctorContact: '', file: FILE },
    ]);
    expect(rows.map((r) => r.fields[0].value)).toEqual(['new', 'old']);
    expect(rows[1].fields).toContainEqual({ label: 'Doctor contact', value: '123' });
  });
});

describe('infirmary', () => {
  const base = { doctorName: '', doctorContact: '', caseNo: '', date: '', complaint: '', symptoms: '', disease: '', treatments: '', closeDate: '', healthCenter: '' };
  it('title is the complaint (fallback), newest first, only the fields that exist', () => {
    const rows = infirmaryRows([
      { ...base, complaint: 'Fever', date: '01-02-2025', symptoms: 'Cough', treatments: 'Rest', healthCenter: 'Clinic', caseNo: 'C-1', doctorName: 'Dr A' },
      { ...base, date: '01-02-2026' },
    ]);
    expect(rows.map((r) => r.title)).toEqual(['Infirmary visit', 'Fever']);
    expect(rows[1].fields.map((f) => f.label)).toEqual(['Symptoms', 'Treatment', 'Health centre', 'Case no.', 'Doctor']);
    expect(rows[0].fields).toEqual([]);
  });
  it('closed when a close date exists, open otherwise', () => {
    const [closed, open] = infirmaryRows([{ ...base, date: '02-02-2026', closeDate: '05-02-2026' }, { ...base, date: '01-02-2026' }]);
    expect(closed.status).toEqual({ label: 'Closed', tone: 'neutral' });
    expect(closed.fields).toContainEqual({ label: 'Closed on', value: '5 Feb 2026' });
    expect(open.status).toEqual({ label: 'Open', tone: 'warning' });
  });
});

describe('consent', () => {
  it('a null / empty status is Pending; known words get their tone; other text is shown as sent', () => {
    const rows = consentRows([
      { title: 'A', date: '01-01-2026', accountableStatus: '', status: '', amount: '' },
      { title: 'B', date: '02-01-2026', accountableStatus: '', status: 'null', amount: '' },
      { title: 'C', date: '03-01-2026', accountableStatus: '', status: 'Approved', amount: '' },
      { title: 'D', date: '04-01-2026', accountableStatus: '', status: 'Yes, signed', amount: '' },
    ]);
    expect(rows.map((r) => r.title)).toEqual(['D', 'C', 'B', 'A']);
    expect(rows.map((r) => r.status)).toEqual([
      { label: 'Yes, signed', tone: 'neutral' },
      { label: 'Approved', tone: 'success' },
      { label: 'Pending', tone: 'warning' },
      { label: 'Pending', tone: 'warning' },
    ]);
  });
  it('numeric amounts are shown in rupees, other text as sent, blank omitted', () => {
    expect(consentAmount('1500')).toBe('₹1,500');
    expect(consentAmount('1250.5')).toBe('₹1,250.50');
    expect(consentAmount('Free')).toBe('Free');
    expect(consentAmount('')).toBe('');
    expect(consentAmount('null')).toBe('');
    const [r] = consentRows([{ title: 'Trip', date: '', accountableStatus: 'Parent', status: '', amount: '1500' }]);
    expect(r.fields).toEqual([{ label: 'Amount', value: '₹1,500' }, { label: 'Accountable', value: 'Parent' }]);
  });
  it('the parsed row has no internal ids', () => {
    const [r] = consentRows([{ title: 'T', date: '', accountableStatus: '', status: '', amount: '', imprest_head_id: '9', created_by: '3' } as never]);
    expect(JSON.stringify(r)).not.toMatch(/imprest|created_by/);
  });
});

describe('transport', () => {
  const t = { fromShift: 'Morning', fromBus: 'Bus 4', fromStop: 'Park Rd', toShift: 'Evening', toBus: 'Bus 5', toStop: 'Mall Rd', gpsLink: '' };
  it('shows pick-up and drop exactly as sent, in the server order, one card per mapping', () => {
    const rows = transportRows([t, { ...t, fromBus: 'Bus 9' }]);
    expect(rows).toHaveLength(2);
    expect(rows[0].fields).toEqual([{ label: 'Pick-up', value: 'Morning · Bus 4 · Park Rd' }, { label: 'Drop', value: 'Evening · Bus 5 · Mall Rd' }]);
    expect(rows[1].fields[0].value).toBe('Morning · Bus 9 · Park Rd');
  });
  it('never fabricates a missing direction or part', () => {
    const [r] = transportRows([{ ...t, toShift: '', toBus: 'null', toStop: '', fromShift: '' }]);
    expect(r.fields).toEqual([{ label: 'Pick-up', value: 'Bus 4 · Park Rd' }]);
    expect(transportRows([])).toEqual([]);
  });
  it('tracking link: https accepted; none when empty; credentials / javascript / intent / file refused', () => {
    expect(trackingLink('https://gps.example.com/track?id=4')).toMatchObject({ state: 'ready', url: 'https://gps.example.com/track?id=4', label: 'Track bus' });
    expect(trackingLink('')).toMatchObject({ state: 'none', url: null });
    for (const bad of ['https://user:pw@gps.example.com/x', 'javascript:alert(1)', 'intent://x', 'file:///etc/passwd', 'tel:123', 'gps.example.com']) {
      expect(trackingLink(bad)).toMatchObject({ state: 'unsafe', url: null });
    }
  });
});

describe('certificates', () => {
  it('newest issued first; type, number, issue date; text is the stripped HTML', () => {
    const rows = certificateRows([
      { type: 'Bonafide', number: '12', html: '<p>This is to certify</p>', createdAt: '2025-04-01 10:00:00' },
      { type: 'Transfer', number: '', html: '<div>Hello <b>World</b></div><script>alert(1)</script>', createdAt: '2026-04-01 09:00:00' },
    ]);
    expect(rows.map((r) => r.title)).toEqual(['Transfer', 'Bonafide']);
    expect(rows[0].date).toBe('1 Apr 2026');
    expect(rows[0].text).toBe('Hello World');
    expect(rows[0].text).not.toMatch(/alert|<|script/);
    expect(rows[1].fields).toEqual([{ label: 'Number', value: '12' }]);
  });
  it('encoded tags stay visible text; empty HTML has no text; long input is fast', () => {
    expect(certificateRows([{ type: 't', number: '', html: '&lt;b&gt;x&lt;/b&gt;', createdAt: '' }])[0].text).toBe('<b>x</b>');
    expect(certificateRows([{ type: 't', number: '', html: '<div></div>', createdAt: '' }])[0].text).toBeUndefined();
    const t0 = Date.now();
    certificateRows([{ type: 't', number: '', html: '<p>'.repeat(200000), createdAt: '' }]);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('type falls back to "Certificate"', () => {
    expect(certificateRows([{ type: ' ', number: '', html: '', createdAt: '' }])[0].title).toBe('Certificate');
  });
});
