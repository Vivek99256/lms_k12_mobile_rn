import { configureApi, SessionContext } from '../src/api/client';
import {
  fetchCertificates,
  fetchConsents,
  fetchHealthRecords,
  fetchHeightWeight,
  fetchInfirmaryRecords,
  fetchTransport,
  fetchVaccinations,
} from '../src/api/student';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const student: SessionContext = {
  token: 'jwt-student',
  subInstituteId: 7,
  syear: '2026',
  userId: 123,
  userProfileId: 3,
  userProfileName: 'Student',
  isStudent: true,
};

const fetchMock = jest.fn();
const onUnauthorized = jest.fn();
const respond = (status: number, body: unknown) =>
  Promise.resolve({ status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

beforeEach(() => {
  fetchMock.mockReset();
  onUnauthorized.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => student, onUnauthorized });
});

const sentForm = () => new URLSearchParams(fetchMock.mock.calls[0][1].body);
const IDENTITY_KEYS = ['admin_id', 'student_id', 'sub_institute_id', 'syear', 'teacher_id', 'token', 'type', 'user_id', 'user_profile_id', 'user_profile_name'];
const st = (data: unknown) => ({ status: 1, message: 'Success', data });
const sc = (data: unknown) => ({ status_code: 1, message: 'Success', data });

const FETCHERS = [
  ['fetchHeightWeight', fetchHeightWeight, 'studentHWAPI', sc],
  ['fetchVaccinations', fetchVaccinations, 'studentVaccinationAPI', sc],
  ['fetchHealthRecords', fetchHealthRecords, 'studentHealthAPI', st],
  ['fetchInfirmaryRecords', fetchInfirmaryRecords, 'studentInfirmaryAPI', sc],
  ['fetchConsents', fetchConsents, 'consentListAPI', sc],
  ['fetchTransport', fetchTransport, 'studentTransportAPI', st],
  ['fetchCertificates', fetchCertificates, 'studentCertificateAPI', sc],
] as const;

const NEVER = [
  'studentHostelAllocationAPI',
  'document_details',
  'student-care',
  'student-infirmary',
  'consent/',
  'front_desk',
  'add_',
  'update',
  'delete',
  'store',
  'payment',
  'upload',
];

describe.each(FETCHERS)('%s', (_name, fn, path, envelope) => {
  it('is an authenticated, form-encoded legacy call with the session identity and type=API, and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, envelope([])));
    await fn();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://dev.triz.co.in/${path}`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('type')).toBe('API');
    expect(sentForm().get('token')).toBe('jwt-student');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('cannot be pointed at another student; only its own read URL is requested - no blocked, staff or write endpoint', async () => {
    fetchMock.mockReturnValue(respond(200, envelope([])));
    await (fn as unknown as (x: unknown) => Promise<unknown>)({ student_id: 999, syear: '1999' });
    expect(sentForm().get('student_id')).toBe('123');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([`https://dev.triz.co.in/${path}`]);
    for (const bad of NEVER) expect(urls.some((u) => u.replace(path, '').includes(bad))).toBe(false);
  });

  it('non-list or missing data is an empty list; non-object rows are skipped', async () => {
    for (const data of [undefined, null, {}, 'x', 5]) {
      fetchMock.mockReturnValue(respond(200, data === undefined ? { status: 1, status_code: 1, message: 'Success' } : envelope(data)));
      expect(await fn()).toEqual([]);
    }
    fetchMock.mockReturnValue(respond(200, envelope([null, 3, 'x'])));
    expect(await fn()).toEqual([]);
  });

  it('"Parameter Missing" is a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, path === 'studentHealthAPI' || path === 'studentTransportAPI' ? { status: 0, message: 'Parameter Missing' } : { status_code: 0, message: 'Parameter Missing' }));
    await expect(fn()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('401 and HTTP 200 status "2" are unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(fn()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fn()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('500 HTML, 419 and network failures surface as errors', async () => {
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fn()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fn()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fn()).rejects.toMatchObject({ kind: 'network' });
  });

  it('reads JSON served as text/html', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(envelope([]))));
    expect(await fn()).toEqual([]);
  });
});

describe('field mapping', () => {
  it('height & weight keeps the values exactly as sent (numbers become text, no unit)', async () => {
    fetchMock.mockReturnValue(respond(200, sc([{ id: 1, student_id: 5, doctor_name: 'Dr A', doctor_contact: '98', height: 150.5, weight: '40', date: '01-01-2026' }])));
    expect(await fetchHeightWeight()).toEqual([{ doctorName: 'Dr A', doctorContact: '98', height: '150.5', weight: '40', date: '01-01-2026' }]);
  });

  it('vaccination', async () => {
    fetchMock.mockReturnValue(respond(200, sc([{ vaccination_type: 'MMR', note: null, date: '01-02-2025', doctor_name: 'Dr A', doctor_contact: null }])));
    expect(await fetchVaccinations()).toEqual([{ vaccinationType: 'MMR', note: '', date: '01-02-2025', doctorName: 'Dr A', doctorContact: '' }]);
  });

  it('health reads the status envelope and keeps the file URL for the model to check', async () => {
    fetchMock.mockReturnValue(respond(200, st([{ doctor_name: 'D', doctor_contact: '1', remarks: 'r', date: '01-01-2026', file: 'https://erp.triz.co.in/storage/frontdesk/noimages.png' }])));
    expect(await fetchHealthRecords()).toEqual([{ doctorName: 'D', doctorContact: '1', remarks: 'r', date: '01-01-2026', file: 'https://erp.triz.co.in/storage/frontdesk/noimages.png' }]);
  });

  it('infirmary', async () => {
    fetchMock.mockReturnValue(
      respond(200, sc([{ id: 1, doctor_name: 'D', doctor_contact: '1', medical_case_no: 'C1', date: '01-01-2026', complaint: 'Fever', symptoms: 's', disease: 'd', treatments: 't', medical_close_date: null, health_center: 'h' }])),
    );
    expect(await fetchInfirmaryRecords()).toEqual([
      { doctorName: 'D', doctorContact: '1', caseNo: 'C1', date: '01-01-2026', complaint: 'Fever', symptoms: 's', disease: 'd', treatments: 't', closeDate: '', healthCenter: 'h' },
    ]);
  });

  it('consent reads status_code, keeps a NULL status as empty, and does not read the internal ids', async () => {
    fetchMock.mockReturnValue(respond(200, sc([{ ID: 1, title: 'Trip', consent_date: '01-01-2026', accountable_status: 'Parent', consent_status: null, amount: '1500', imprest_head_id: 9, created_by: 3 }])));
    const out = await fetchConsents();
    expect(out).toEqual([{ title: 'Trip', date: '01-01-2026', accountableStatus: 'Parent', status: '', amount: '1500' }]);
    expect(JSON.stringify(out)).not.toMatch(/imprest|created_by/);
  });

  it('transport reads the status envelope, gps_link is optional', async () => {
    fetchMock.mockReturnValue(respond(200, st([{ id: 1, student_id: 5, from_shift: 'M', from_bus: 'B4', from_stop_name: 'P', to_shift: 'E', to_bus: 'B5', to_stop_name: 'Q' }])));
    expect(await fetchTransport()).toEqual([{ fromShift: 'M', fromBus: 'B4', fromStop: 'P', toShift: 'E', toBus: 'B5', toStop: 'Q', gpsLink: '' }]);
  });

  it('certificates', async () => {
    fetchMock.mockReturnValue(respond(200, sc([{ id: 1, certificate_type: 'Bonafide', certificate_number: 12, certificate_html: '<p>x</p>', created_at: '2026-04-01 10:00:00' }])));
    expect(await fetchCertificates()).toEqual([{ type: 'Bonafide', number: '12', html: '<p>x</p>', createdAt: '2026-04-01 10:00:00' }]);
  });
});
