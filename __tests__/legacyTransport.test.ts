import { api, configureApi, legacyFields, SessionContext } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { legacy } from '../src/api/legacy';

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
const teacher: SessionContext = {
  ...student,
  token: 'jwt-teacher',
  userId: 55,
  userProfileId: 2,
  userProfileName: 'Teacher',
  isStudent: false,
};

/** A fetch Response that only has what the client uses: status and text(). */
const respond = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response);

const fetchMock = jest.fn();
let onUnauthorized: jest.Mock;
let session: SessionContext;

beforeEach(() => {
  session = student;
  onUnauthorized = jest.fn();
  fetchMock.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => session, onUnauthorized });
});

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: url as string, init, form: new URLSearchParams(init.body ?? '') };
};

describe('legacyFields', () => {
  it('builds the identity block from the session (student)', () => {
    expect(legacyFields(student)).toEqual({
      token: 'jwt-student',
      sub_institute_id: '7',
      syear: '2026',
      user_id: '123',
      teacher_id: '123',
      admin_id: '123',
      student_id: '123',
      user_profile_id: '3',
      user_profile_name: 'Student',
      type: 'API',
    });
  });

  it('never lets a screen override token, tenant, type or role', () => {
    const f = legacyFields(teacher, {
      token: 'x',
      sub_institute_id: 999,
      type: 'JSON',
      user_profile_id: 1,
      user_profile_name: 'Super Admin',
    });
    expect(f.token).toBe('jwt-teacher');
    expect(f.sub_institute_id).toBe('7');
    expect(f.type).toBe('API');
    expect(f.user_profile_id).toBe('2');
    expect(f.user_profile_name).toBe('Teacher');
  });

  it('student identity protection: a student cannot act as or look up another id', () => {
    const f = legacyFields(student, { student_id: 999, user_id: 1, teacher_id: 2, admin_id: 3 });
    expect([f.student_id, f.user_id, f.teacher_id, f.admin_id]).toEqual(['123', '123', '123', '123']);
  });

  it('an unknown role (isStudent undefined) is treated like a student: fails closed', () => {
    const f = legacyFields({ ...student, isStudent: undefined }, { student_id: 999 });
    expect(f.student_id).toBe('123');
  });

  it('a staff session may choose the student / acting id and the school year', () => {
    const f = legacyFields(teacher, { student_id: 999, syear: '2025', standard_id: 4, flag: true, nothing: null });
    expect(f.student_id).toBe('999');
    expect(f.syear).toBe('2025');
    expect(f.standard_id).toBe('4');
    expect(f.flag).toBe('true');
    expect('nothing' in f).toBe(false);
    expect(f.user_id).toBe('55'); // untouched own id
  });

  it('omits identity fields the session does not have instead of sending "undefined"', () => {
    const f = legacyFields({ token: 't' });
    expect(f).toEqual({ token: 't', type: 'API' });
  });
});

describe('legacy requests', () => {
  it('POSTs form-encoded with the bearer header and the identity block', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success', data: { a: 1 } }));
    const res = await legacy.post<{ a: number }>('studentAttendanceAPI');
    const { url, init, form } = sent();
    expect(url).toBe('https://dev.triz.co.in/studentAttendanceAPI');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect(form.get('student_id')).toBe('123');
    expect(form.get('sub_institute_id')).toBe('7');
    expect(form.get('syear')).toBe('2026');
    expect(form.get('type')).toBe('API');
    expect(form.get('token')).toBe('jwt-student');
    expect(res.data).toEqual({ a: 1 });
  });

  it('GET carries the same block in the query string', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [] }));
    await legacy.get('thing', { standard_id: 2 });
    const { url, init } = sent();
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('student_id')).toBe('123');
    expect(q.get('standard_id')).toBe('2');
    expect(q.get('type')).toBe('API');
  });

  it('extra fields reach the form but cannot replace the student id', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [] }));
    await legacy.post('x', { action: 'Homework', student_id: 999 });
    const { form } = sent();
    expect(form.get('action')).toBe('Homework');
    expect(form.get('student_id')).toBe('123');
  });

  it('rejects array/object field values instead of sending "[object Object]"', async () => {
    await expect(api.post('x', { legacy: true, body: { student: { 1: 'P' } } })).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non-legacy calls are unchanged: JSON body, no student_id', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '1', data: [] }));
    await api.post('api/x', { body: { a: 1 } });
    const { init } = sent();
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ a: 1, type: 'API', sub_institute_id: '7', token: 'jwt-student' });
    expect('student_id' in body).toBe(false);
  });
});

describe('token protection', () => {
  it('never contacts or sends the token to an unknown host', async () => {
    await expect(legacy.post('https://evil.example.com/collect')).rejects.toMatchObject({ kind: 'config' });
    await expect(api.get('https://evil.example.com/collect')).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-bases a production tile URL onto the configured API host', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [] }));
    await legacy.post('https://erp.triz.co.in/studentAttendanceAPI');
    expect(sent().url).toBe('https://dev.triz.co.in/studentAttendanceAPI');
  });

  it('a look-alike host is blocked', async () => {
    await expect(legacy.post('https://erp.triz.co.in.evil.com/x')).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not put the token in error messages', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '0', message: 'Parameter Missing' }));
    const e = (await legacy.post('studentAttendanceAPI').catch((x) => x)) as ApiError;
    expect(e.message).toBe('Parameter Missing');
    expect(e.message).not.toContain('jwt-student');
  });
});

describe('response parsing', () => {
  it('parses a JSON body served as text/html (the response object has no json())', async () => {
    fetchMock.mockReturnValue(respond(200, '{"status":1,"message":"Success","data":{"k":"v"}}'));
    const res = await legacy.post<{ k: string }>('x');
    expect(res.data).toEqual({ k: 'v' });
  });

  it('tolerates a UTF-8 BOM and surrounding whitespace', async () => {
    fetchMock.mockReturnValue(respond(200, '﻿  {"status":1,"data":[1]}\n'));
    expect((await legacy.post('x')).data).toEqual([1]);
  });

  it('HTML / non-JSON on a 200 is a server error (no guessing, no PHP-warning stripping)', async () => {
    fetchMock.mockReturnValue(respond(200, '<br /><b>Warning</b>: Undefined offset'));
    const e = (await legacy.post('x').catch((x) => x)) as ApiError;
    expect(e.kind).toBe('server');
    expect(e.message).toBe('The server returned an unexpected response.');
  });

  it('a body that cannot be read as text is a server error, not a crash', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ status: 200, text: () => Promise.resolve(undefined) } as unknown as Response));
    await expect(legacy.post('x')).rejects.toMatchObject({ kind: 'server' });
    fetchMock.mockReturnValue(Promise.resolve({ status: 200, text: () => Promise.reject(new Error('stream')) } as unknown as Response));
    await expect(legacy.post('x')).rejects.toMatchObject({ kind: 'server' });
  });

  it('401 with the legacy body signs the user out', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(legacy.post('x')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 with an empty body still signs out', async () => {
    fetchMock.mockReturnValue(respond(401, ''));
    await expect(legacy.post('x')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('HTTP 200 + status "2" (fees, WRT report) signs out', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(legacy.post('fees/PaidUnpaid')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('"Parameter Missing" (status 0, HTTP 200) is a validation error and does not sign out', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(legacy.post('x')).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a response-only 200 body surfaces as a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { response: { reply: ['The reply field is required.'] } }));
    await expect(legacy.post('x')).rejects.toMatchObject({
      kind: 'validation',
      message: 'The reply field is required.',
    });
  });
});

describe('419 handling', () => {
  it('shows the server-address message for an HTML 419 page and does not sign out', async () => {
    fetchMock.mockReturnValue(respond(419, '<!DOCTYPE html><title>Page Expired</title>'));
    const e = (await legacy.post('studentAttendanceAPI').catch((x) => x)) as ApiError;
    expect(e.kind).toBe('server');
    expect(e.status).toBe(419);
    expect(e.message).toMatch(/server address/i);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('an empty-body 419 gives the same message', async () => {
    fetchMock.mockReturnValue(respond(419, ''));
    await expect(legacy.post('x')).rejects.toMatchObject({ status: 419 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
