#!/usr/bin/env node
/**
 * Synthetic mock API for the Device / Native Pass. DEV TOOL ONLY.
 *
 *  - Everything it serves is FABRICATED. It never connects to the real Laravel backend, a database, or any other host, and
 *    it has no code path that forwards a request anywhere.
 *  - It uses only Node's built-in modules (no package), listens on loopback only, and is not imported by the app, so it
 *    can never end up in the app bundle (Metro bundles only what the entry file imports).
 *  - It records every request it receives, and `GET /__mock/audit` checks them against an allow-list: no unexpected
 *    (write / staff / admin / front_desk / HR / Learn / classwork ...) endpoint, and no JWT in any URL.
 *
 *  node tools/mock-api/server.js            (MOCK_PORT=8787, MOCK_LOG=<file> optional)
 *  Control (from the host, not the app):
 *    POST /__mock/mode   {"match":"fees/PaidUnpaid","mode":"ok|empty|500|401|422|404"}   (match = path substring; "*" = everything)
 *    POST /__mock/reset  /  POST /__mock/clear-log  /  GET /__mock/log  /  GET /__mock/audit
 *  Fabricated accounts (password "demo123"): student@demo.test, teacher@demo.test, mismatch@demo.test
 */
'use strict';
const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.MOCK_PORT || 8787);
const LOG_FILE = process.env.MOCK_LOG || '';
const TOKENS = { 'mock.jwt.student': 'student', 'mock.jwt.teacher': 'teacher', 'mock.jwt.mismatch': 'mismatch' };
const ACCOUNTS = {
  'student@demo.test': { kind: 'student', token: 'mock.jwt.student', id: 900001, first: 'Demo', last: 'Student', profile: 'Student', profileId: 3 },
  'teacher@demo.test': { kind: 'teacher', token: 'mock.jwt.teacher', id: 900002, first: 'Demo', last: 'Teacher', profile: 'Teacher', profileId: 2 },
  'mismatch@demo.test': { kind: 'mismatch', token: 'mock.jwt.mismatch', id: 900003, first: 'Mismatch', last: 'Student', profile: 'Student', profileId: 3 },
};
const SCHOOL = 'Demo School (fabricated)';

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d; };
const iso = (off = 0) => { const d = day(off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dmy = (off = 0) => { const d = day(off); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; };
const dmyHms = (off = 0, hms = '09:30:00') => `${dmy(off)} ${hms}`;
const ts = (off = 0, hms = '09:30:00') => `${iso(off)} ${hms}`;
const BASE = () => `http://127.0.0.1:${PORT}`;

const state = { modes: [], log: [] };

const ok = (data, extra = {}) => ({ status: 1, message: 'Success', data, ...extra });
const okCode = (data) => ({ status_code: 1, message: 'Success', data });
const okModern = (data, meta) => ({ success: true, message: 'Success', data, errors: null, ...(meta ? { meta } : {}) });

// ---------- fabricated fixtures ----------
const FIX = {
  dashboard: () => ({
    enrollment: { syear: '2026', standard_name: 'Class 7', section_name: 'A' },
    summary: { total_subjects: 6, pending_homework: 2, pending_assignments: 1 },
    my_subjects: [{ id: 1, subject_name: 'Mathematics' }, { id: 2, subject_name: 'Science' }, { id: 3, subject_name: 'English' }],
    pending_homework: [{ id: 11, title: 'Fractions worksheet', subject_id: 1, date: iso(-2), submission_date: iso(1) }, { id: 12, title: 'Plant cell diagram', subject_id: 2, date: iso(-1), submission_date: iso(3) }],
    pending_assignments: [{ id: 21, title: 'Reading log', subject_id: 3, submission_date: iso(5) }],
    recent_circulars: [{ id: 31, title: 'Annual day rehearsal', date_: iso(-1) }],
    task_status: [{ label: 'Homework done', value: 7 }, { label: 'Homework pending', value: 2 }],
    achievements: [],
  }),
  attendance: () => ({
    attendance_data: [{ attendance_date: iso(-1), attendance_code: 'P' }, { attendance_date: iso(-2), attendance_code: 'P' }, { attendance_date: iso(-3), attendance_code: 'A' }, { attendance_date: iso(-4), attendance_code: 'P' }],
    calendar_data: {
      holiday: [{ school_date: iso(6), title: 'Demo holiday', description: 'Fabricated holiday', event_type: 'holiday' }],
      event: [{ school_date: iso(4), title: 'Demo sports day', description: 'Fabricated event', event_type: 'event' }],
      vacation: [],
    },
  }),
  calendar: (action) => {
    const rows = [
      { school_date: iso(6), title: 'Demo holiday', description: 'Fabricated holiday', event_type: 'holiday' },
      { school_date: iso(4), title: 'Demo sports day', description: 'Fabricated event', event_type: 'event' },
      { school_date: iso(12), title: 'Demo vacation', description: 'Fabricated vacation', event_type: 'vacation' },
    ];
    return action === 'holiday' ? rows.filter((r) => r.event_type === 'holiday') : rows;
  },
  notifications: () => [
    { ID: 1, NOTIFICATION_TYPE: 'Homework', NOTIFICATION_DESCRIPTION: 'New homework: Fractions worksheet. See https://example.test/help for tips.', NOTIFICATION_DATE: dmy(-1) },
    { ID: 2, NOTIFICATION_TYPE: 'Circular', NOTIFICATION_DESCRIPTION: 'Annual day rehearsal tomorrow. Please wear the school uniform.', NOTIFICATION_DATE: dmy(-2) },
    { ID: 3, NOTIFICATION_TYPE: 'Student Remarks', NOTIFICATION_DESCRIPTION: 'javascript:alert(1) and tel:123456 must stay inert text.', NOTIFICATION_DATE: dmy(-3) },
  ],
  circulars: (kind) =>
    kind === 'Event'
      ? [{ id: 52, title: 'Demo science fair', message: 'Fabricated event details.', date_: dmy(-1), file_name: '' }]
      : [
          { id: 51, title: 'Annual day rehearsal', message: 'Rehearsal tomorrow. Details: https://example.test/annual-day', date_: dmy(-1), file_name: 'https://erp.triz.co.in/storage/circular/notice.pdf' },
          { id: 53, title: 'Unsafe link demo', message: 'Attachment host is not trusted.', date_: dmy(-2), file_name: 'https://evil.example/a.pdf' },
        ],
  timetable: () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows = [];
    days.forEach((w) => {
      rows.push({ week_day: w, standard_name: '7', subject_name: 'Mathematics', teacher_name: 'Demo Teacher One', period_name: 'Period 1', start_time: '09:00:00', end_time: '09:45:00', studentbatch: null, batch_name: null, batch_id: null, period_id: 1 });
      rows.push({ week_day: w, standard_name: '7', subject_name: 'Science', teacher_name: 'Demo Teacher Two', period_name: 'Period 2', start_time: '09:50:00', end_time: '10:35:00', studentbatch: null, batch_name: null, batch_id: null, period_id: 2 });
    });
    rows.push({ week_day: 'Mon', standard_name: '7', subject_name: 'Sanskrit,French', teacher_name: 'Demo Teacher Three,Demo Teacher Four', period_name: null, start_time: null, end_time: null, studentbatch: '2', batch_name: 'B1', batch_id: 2, period_id: null });
    return rows;
  },
  exams: () => [
    { title: 'Mid-term exam schedule', date_: iso(10), file_name: 'https://erp.triz.co.in/storage/exam_schedule/mid.pdf' },
    { title: 'Unit test (earlier)', date_: iso(-20), file_name: '' },
    { title: 'Date to be confirmed exam', date_: '', file_name: '' },
  ],
  homeworkList: () => [
    { id: 11, title: 'Fractions worksheet', subject_name: 'Mathematics', date: iso(-2), submission_date: iso(1), status: null, submission_files: [], ai_status: '' },
    { id: 12, title: 'Plant cell diagram', subject_name: 'Science', date: iso(-1), submission_date: iso(-1), status: null, submission_files: [], ai_status: '' },
    { id: 13, title: 'Essay: my school', subject_name: 'English', date: iso(-9), submission_date: iso(-5), status: 'Reviewed', submission_files: [{ id: 1 }], ai_status: 'Evaluated' },
  ],
  homeworkDetail: (id) => ({
    homework: { id: Number(id), title: `Homework ${id}`, description: '<p>Solve the questions. <b>Show your work.</b></p>', subject_name: 'Mathematics', standard_name: '7', division_name: 'A', date: iso(-2), submission_date: iso(1), teacher_name: 'Demo Teacher One', reference_file_url: 'https://erp.triz.co.in/storage/homework/ref.pdf', questions: [{ id: 1, question_title: '<p>What is 1/2 + 1/4?</p>', description: '', points: 2 }] },
    submissions: Number(id) === 13 ? [{ status: 'Reviewed', submitted_at: ts(-6), submission_remarks: 'Done', teacher_remarks: 'Well written', ai_status: 'Evaluated', ai_score: 8, ai_total_questions: 10, ai_percentage: 80, feedback_published: true, files: [{ id: 1, original_name: 'essay.pdf', file_url: 'https://erp.triz.co.in/storage/homework/essay.pdf' }] }] : [],
  }),
  fees: () => ({ response: { student_id: 900001, breack_off_amount: 125000, paid_amount: 80000, unpaid_amount: 45000 }, message: 'Sucsess', status: '1' }),
  results: () => [
    { id: 1, syear: 2026, sub_institute_id: 9001, student_id: 900001, term_name: 'Term 1', file_name: 'https://erp.triz.co.in/storage/upload_result/term1.pdf' },
    { id: 2, syear: 2026, sub_institute_id: 9001, student_id: 900001, term_name: 'Term 2', file_name: '' },
    { id: 3, syear: 2026, sub_institute_id: 9001, student_id: 900001, term_name: 'Unsafe term', file_name: 'https://evil.example/r.pdf' },
  ],
  leave: () => [
    { title: 'Fever', message: 'Down with fever.', files: 'https://erp.triz.co.in/storage/leave_application/note.pdf', apply_date: dmyHms(-5), from_date: iso(-4), to_date: iso(-2), status: 'Approved', reply: 'Get well soon.', reply_by: 'Demo Teacher One', reply_on: dmyHms(-4, '11:00:00') },
    { title: 'Family function', message: 'Out of town.', files: '', apply_date: dmyHms(-1), from_date: iso(3), to_date: iso(3), status: null, reply: null, reply_by: '', reply_on: null },
  ],
  messages: () => [
    { title: 'Bus timing', message: 'Is the bus timing changing?', created_at: ts(-2), reply: 'Yes, 10 minutes earlier.', reply_on: dmy(-1), reply_by: 'Demo Admin' },
    { title: 'Fee receipt', message: 'Please share the receipt.', created_at: ts(-1), reply: null, reply_on: null, reply_by: null },
  ],
  teachers: () => [
    { teacher_name: 'Demo Teacher One', image: 'https://erp.triz.co.in/storage/user/a.png', mobile: '0000000001', subject_name: 'Mathematics,Science' },
    { teacher_name: 'Demo Teacher Two', image: '', mobile: '0000000002', subject_name: 'English' },
  ],
  hw: () => [{ id: 1, student_id: 900001, doctor_name: 'Dr Demo', doctor_contact: '0000000003', height: 152.5, weight: 41, date: dmy(-30) }, { id: 2, student_id: 900001, doctor_name: 'Dr Demo', doctor_contact: '0000000003', height: 148, weight: 38, date: dmy(-200) }],
  vaccination: () => [{ id: 1, student_id: 900001, doctor_name: 'Dr Demo', doctor_contact: '0000000003', vaccination_type: 'MMR (fabricated)', note: 'Dose 1', date: dmy(-100) }],
  health: () => [
    { doctor_name: 'Dr Demo', doctor_contact: '0000000003', remarks: 'Fabricated routine check-up.', date: dmy(-40), file: `${BASE()}/storage/frontdesk/report.pdf` },
    { doctor_name: '', doctor_contact: '', remarks: 'Fabricated note without a document.', date: dmy(-80), file: `${BASE()}/storage/frontdesk/noimages.png` },
  ],
  infirmary: () => [{ id: 1, student_id: 900001, doctor_name: 'Dr Demo', doctor_contact: '0000000003', medical_case_no: 'C-1', date: dmy(-15), complaint: 'Headache (fabricated)', symptoms: 'Mild headache', disease: 'None', treatments: 'Rest', medical_close_date: dmy(-14), health_center: 'School clinic' }],
  consent: () => [{ ID: 1, title: 'Demo field trip', consent_date: dmy(-3), accountable_status: 'Parent', consent_status: null, amount: '1500', imprest_head_id: 9, created_by: 3 }],
  transport: () => [{ id: 1, student_id: 900001, from_shift: 'Morning', from_bus: 'Bus 4', from_stop_name: 'Park Road', to_shift: 'Evening', to_bus: 'Bus 5', to_stop_name: 'Mall Road', gps_link: 'https://example.test/track/bus4' }],
  certificates: () => [{ id: 1, certificate_type: 'Bonafide (fabricated)', syear: 2026, student_id: 900001, sub_institute_id: 9001, certificate_number: 12, certificate_html: '<div><h2>Bonafide Certificate</h2><p>This is to certify that <b>Demo Student</b> studies in Class 7.</p><script>alert(1)</script></div>', created_at: ts(-60) }],
  discipline: () => [
    { discipline: 'Good', message: 'Helped a classmate (fabricated).', discipline_date: iso(-3), flag: 1 },
    { discipline: 'Check', message: 'Late to class once (fabricated).', discipline_date: iso(-10), flag: 0 },
    { discipline: 'Bad', message: 'Forgot homework twice (fabricated).', discipline_date: iso(-20), flag: -1 },
  ],
  school: (action) => {
    const pages = {
      'About Us': '<h2>About Demo School</h2><p>A fabricated school. Visit https://example.test/about for more.</p><ul><li>Founded 1990</li><li>Co-educational</li></ul>',
      'Principal Desk': "<p>Dear students, welcome to the fabricated principal's message.</p>",
      'School Timing': '<p>Monday to Saturday, 9:00 to 15:30.</p>',
      Rules: '<ol><li>Be on time</li><li>Respect everyone</li></ol>',
    };
    return pages[action] ? [{ title: action, description: pages[action] }] : [];
  },
  gallery: (kind) =>
    kind === 'Photo'
      ? { 'Sports Day (fabricated)': [{ album_title: 'Sports Day (fabricated)', title: 'Relay race', file_name: `${BASE()}/storage/photo_video_gallary/relay.jpg`, date_: iso(-5), ai: 'Active', type: 'Photo' }, { album_title: 'Sports Day (fabricated)', title: 'Unsafe photo link', file_name: 'https://evil.example/p.jpg', date_: iso(-6), ai: 'Active', type: 'Photo' }], 'Trip (fabricated)': [{ album_title: 'Trip (fabricated)', title: 'Museum', file_name: `${BASE()}/storage/photo_video_gallary/museum.jpg`, date_: iso(-30), ai: 'Active', type: 'Photo' }] }
      : { 'Assembly (fabricated)': [{ album_title: 'Assembly (fabricated)', title: 'Morning assembly', file_name: 'https://example.test/video/assembly', date_: iso(-8), ai: 'Active', type: 'Video' }] },
  discussions: () => [
    { id: 70, title: 'How do I add fractions?', description: 'I do not understand unlike denominators.', visibility: 'private', subject_id: 1, chapter_id: 2, topic_id: 3, attachment_url: `${BASE()}/storage/lms_doubts/note.pdf`, created_at: ts(-3), total_days: 3, comment_count: 2, author: { user_id: 900001, name: 'Demo Student', type: 'student', class: '7/A', avatar_url: `${BASE()}/storage/student/no-image.jpg` } },
    { id: 71, title: 'Photosynthesis question', description: 'Where does the oxygen come from?', visibility: 'public', subject_id: 2, chapter_id: 4, topic_id: 5, attachment_url: null, created_at: ts(-6), total_days: 6, comment_count: 0, author: { user_id: 900001, name: 'Demo Student', type: 'student', class: '7/A', avatar_url: `${BASE()}/storage/student/no-image.jpg` } },
  ],
  discussionDetail: (id) => {
    const base = FIX.discussions().find((d) => String(d.id) === String(id));
    if (!base) return null;
    return { ...base, comments: id === '70' ? [{ id: 1, doubt_id: 70, message: 'Find a common denominator first.', created_at: ts(-3, '10:00:00'), author: { user_id: 900002, name: 'Demo Teacher One', type: 'user', class: null, avatar_url: '' } }, { id: 2, doubt_id: 70, message: 'Thank you, that helped!', created_at: ts(-2, '09:00:00'), author: { user_id: 900001, name: 'Demo Student', type: 'student', class: '7/A', avatar_url: '' } }] : [] };
  },
};

// ---------- menu ----------
const tile = (title, screen, api, extra = {}) => ({ title, icon: null, api: api ? `https://erp.triz.co.in/${api}` : null, api_param: null, screen_name: screen, render_type: 'native', web_url: null, open_mode: 'in_app', ...extra });
const STUDENT_MENU = [
  { main_title: 'Activity', color: '#0d6efd', contents: [
    tile('Student Attendance', 'student_attendance', 'studentAttendanceAPI'), tile('Academic Calendar', 'academic_calendar', 'studentCalenderAPI'),
    tile('Circular & Events', 'circular_events', 'circular/fetchData'), tile('Notification Hub', 'notification_hub', 'notificationHubAPI'),
    tile('Time Table', 'time_table', 'studentTimetableAPI'), tile('Exam Schedule', 'exam_schedule', 'studentExamScheduleAPI'),
    tile('Home Work', 'home_work', 'studentHomeworkAssignmentAPI'), tile('Fees Details', 'fees', 'fees/PaidUnpaid'),
    tile('Result PDF', 'result_pdf', 'uploadResultAPI'), tile('Student Discipline', 'child_remark', 'studentDisciplineAPI'),
    tile('Achievement Certificate', 'achievement_certificate', 'document_details'),
  ] },
  { main_title: 'Student Detail', color: '#4f46e5', contents: [
    tile('Transport', 'student_transport', 'studentTransportAPI'), tile('Height Weight', 'height_weight', 'studentHWAPI'),
    tile('Infirmary', 'student_infirmary', 'studentInfirmaryAPI'), tile('Consent', 'student_consent', 'consentListAPI'),
    tile('Vaccination', 'student_vaccination', 'studentVaccinationAPI'), tile('Certificate', 'student_certificate', 'studentCertificateAPI'),
    tile('Hostel', 'student_hostel', 'studentHostelAllocationAPI'), tile('Classwork Gallery', 'classwork_gallery', null),
  ] },
  { main_title: 'Profile Gallery', color: '#10b981', contents: [
    tile('Photos Gallery', 'photos_gallery', 'studentPhotoVideoGalleryAPI'), tile('Video Gallery', 'video_gallery', 'studentPhotoVideoGalleryAPI'),
    tile('Subject Teachers', 'subjects', 'studentTeacherListAPI'), tile('Health Details', 'health_details', 'studentHealthAPI'),
  ] },
  { main_title: 'School Detail', color: '#1e3a8a', contents: [
    tile("Principal's Desk", 'principal_desk', 'schoolDetailAPI'), tile('About Us', 'about_us', 'schoolDetailAPI'), tile('Reach us', 'reach_us', 'schoolDetailAPI'),
    tile('School Timing', 'school_timing', 'schoolDetailAPI'), tile('Rules', 'rules', 'schoolDetailAPI'), tile('Facility', 'facility', 'schoolDetailAPI'),
  ] },
  { main_title: 'LMS', color: '#7c3aed', contents: [
    tile('Social Collaborative', 'social_collabrative', 'studentSocialCollabrativeAPI'), tile('Learn', 'lms_subject', 'studentSubjectAPI'), tile('Live Lecture', 'live_lecture', 'x'),
  ] },
  { main_title: 'Utility', color: '#0891b2', contents: [
    tile('Leave Application', 'leave_application', 'studentLeaveApplicationAPI'), tile('Parent Communication', 'parent_communication', 'add_communicationAPI'),
  ] },
];

// ---------- allow-list for the audit (exactly the endpoints the app is permitted to call) ----------
const ALLOW = [
  /^api\/api-login$/, /^api\/mobile\/bootstrap$/, /^api\/student-dashboard\/summary$/,
  /^studentAttendanceAPI$/, /^studentCalenderAPI$/, /^notificationHubAPI$/, /^circular\/fetchData$/,
  /^studentTimetableAPI$/, /^studentExamScheduleAPI$/, /^api\/lms-homework\/my-submissions$/, /^api\/lms-homework\/detail\/\d+$/,
  /^fees\/PaidUnpaid$/, /^uploadResultAPI$/, /^studentLeaveApplicationAPI$/, /^studentParentcommunicationListAPI$/, /^studentTeacherListAPI$/,
  /^studentHWAPI$/, /^studentVaccinationAPI$/, /^studentHealthAPI$/, /^studentInfirmaryAPI$/, /^consentListAPI$/, /^studentTransportAPI$/, /^studentCertificateAPI$/, /^studentDisciplineAPI$/,
  /^schoolDetailAPI$/, /^studentPhotoVideoGalleryAPI$/, /^api\/lms\/social-collaborative$/, /^api\/lms\/social-collaborative\/\d+$/, /^api\/own-profile$/,
];
const STATIC = /^storage\//;

// ---------- request handling ----------
function modeFor(path) {
  for (let i = state.modes.length - 1; i >= 0; i--) {
    const m = state.modes[i];
    if (m.match === '*' || path.includes(m.match)) return m.mode;
  }
  return 'ok';
}

function send(res, status, body, type) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': type || (isStr ? 'text/html; charset=utf-8' : 'application/json') });
  res.end(isStr ? body : JSON.stringify(body));
}

const FAKE_PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const FAKE_JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

function legacyPath(p) {
  return !p.startsWith('api/') || p === 'api/api-login' ? !p.startsWith('api/') : false;
}

function handle(req, res, bodyRaw) {
  const u = new URL(req.url, 'http://x');
  const path = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const ctype = String(req.headers['content-type'] || '');
  let body = {};
  if (bodyRaw) {
    try {
      body = /json/i.test(ctype) ? JSON.parse(bodyRaw) : Object.fromEntries(new URLSearchParams(bodyRaw).entries());
    } catch (e) { body = {}; }
  }
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const tokenFromBody = typeof body.token === 'string' ? body.token : '';
  const tokenFromQuery = u.searchParams.get('token') || '';
  const knownTokens = Object.keys(TOKENS);
  const entry = {
    t: new Date().toISOString(), method: req.method, path, queryKeys: [...u.searchParams.keys()], bodyKeys: Object.keys(body), bearer: !!bearer,
    tokenInUrl: !!tokenFromQuery || knownTokens.some((k) => req.url.includes(k)), tokenInBody: !!tokenFromBody, ua: String(req.headers['user-agent'] || '').slice(0, 60),
    isStatic: STATIC.test(path), isControl: path.startsWith('__mock/'), allowed: ALLOW.some((r) => r.test(path)) || STATIC.test(path) || path.startsWith('__mock/'), status: 0,
  };
  const finish = (status, payload, type) => { entry.status = status; record(entry); send(res, status, payload, type); };

  // control plane
  if (path.startsWith('__mock/')) {
    if (path === '__mock/mode' && req.method === 'POST') { state.modes.push({ match: String(body.match || '*'), mode: String(body.mode || 'ok') }); return finish(200, { ok: true, modes: state.modes }); }
    if (path === '__mock/reset') { state.modes = []; return finish(200, { ok: true }); }
    if (path === '__mock/clear-log') { state.log.length = 0; entry.status = 200; return send(res, 200, { ok: true }); }
    if (path === '__mock/log') { entry.status = 200; return send(res, 200, state.log); }
    if (path === '__mock/audit') { entry.status = 200; return send(res, 200, audit()); }
    return finish(404, { error: 'unknown control' });
  }

  // fabricated files that the phone's browser opens (no token expected)
  if (entry.isStatic) {
    if (/\.pdf$/i.test(path)) return finish(200, FAKE_PDF, 'application/pdf');
    if (/\.(jpg|jpeg)$/i.test(path)) return finish(200, FAKE_JPG, 'image/jpeg');
    return finish(200, '<html><body>Fabricated file</body></html>');
  }

  // login
  if (path === 'api/api-login') {
    const acct = ACCOUNTS[String(body.email || '').trim().toLowerCase()];
    if (modeFor(path) === '500') return finish(500, '<html>Server Error</html>');
    if (!acct || body.password !== 'demo123') return finish(401, { success: false, message: 'Wrong email or password (mock).', data: null });
    return finish(200, { success: true, message: 'Login successful', data: { id: acct.id, email: acct.kind === 'mismatch' ? 'mismatch@demo.test' : `${acct.kind}@demo.test`, first_name: acct.first, last_name: acct.last, user_profile: acct.profile, user_profile_id: acct.profileId, sub_institute_id: 9001, is_admin: 0, client_id: null, mobile_syear: '2026', school_name: SCHOOL, user_token: acct.token } });
  }

  const legacy = legacyPath(path);
  const token = bearer || tokenFromBody || tokenFromQuery;
  const who = TOKENS[token];
  const mode = modeFor(path);
  const unauth = () => (legacy ? finish(401, { status: '2', message: 'JWT token is required.', data: [] }, 'application/json') : finish(401, { success: false, message: 'JWT token is required.', data: null, errors: null }));
  if (!who || mode === '401') return unauth();
  if (mode === '500') return finish(500, '<html><body>Server Error</body></html>');
  if (mode === '422' && !legacy) return finish(422, { success: false, message: 'Academic Term Date Expired', data: null, errors: null });
  const empty = mode === 'empty';
  const dataOr = (v, e) => (empty ? e : v);

  switch (true) {
    case path === 'api/mobile/bootstrap':
      return finish(200, okModern({ user: { id: 1, sub_institute_id: 9001, user_profile_id: 3, user_profile_name: who === 'teacher' ? 'Teacher' : 'Student', is_student: who !== 'teacher', is_admin: 0, school_name: SCHOOL }, menu: who === 'teacher' ? [] : STUDENT_MENU }));
    case path === 'api/student-dashboard/summary': {
      const d = FIX.dashboard();
      if (empty) { d.pending_homework = []; d.pending_assignments = []; d.recent_circulars = []; d.summary = { total_subjects: 0, pending_homework: 0, pending_assignments: 0 }; d.task_status = []; d.my_subjects = []; }
      return finish(200, d);
    }
    case path === 'studentAttendanceAPI': return finish(200, ok(dataOr(FIX.attendance(), { attendance_data: [], calendar_data: { holiday: [], event: [], vacation: [] } })));
    case path === 'studentCalenderAPI': return finish(200, ok(dataOr(FIX.calendar(body.action), [])));
    case path === 'notificationHubAPI': return finish(200, ok(dataOr(FIX.notifications(), [])));
    case path === 'circular/fetchData': return finish(200, ok(dataOr(FIX.circulars(body.action), [])));
    case path === 'studentTimetableAPI': return finish(200, ok(dataOr(FIX.timetable(), [])));
    case path === 'studentExamScheduleAPI': return finish(200, ok(dataOr(FIX.exams(), [])));
    case path === 'api/lms-homework/my-submissions': return finish(200, okModern(dataOr(FIX.homeworkList(), [])));
    case /^api\/lms-homework\/detail\/\d+$/.test(path): return finish(200, okModern(FIX.homeworkDetail(path.split('/').pop())));
    case path === 'fees/PaidUnpaid':
      if (empty) return finish(200, { response: { bf_error: ['No Breackoff Found.'] }, status: '0', message: 'Data Not Found.' });
      if (mode === '404') return finish(500, '<html>Server Error</html>');
      return finish(200, FIX.fees());
    case path === 'uploadResultAPI': return finish(200, ok(dataOr(FIX.results(), [])));
    case path === 'studentLeaveApplicationAPI': return finish(200, ok(dataOr(FIX.leave(), [])));
    case path === 'studentParentcommunicationListAPI': return finish(200, okCode(dataOr(FIX.messages(), [])));
    case path === 'studentTeacherListAPI': return finish(200, empty ? { status: 0, message: 'Wrong Parameters' } : ok(FIX.teachers()));
    case path === 'studentHWAPI': return finish(200, okCode(dataOr(FIX.hw(), [])));
    case path === 'studentVaccinationAPI': return finish(200, okCode(dataOr(FIX.vaccination(), [])));
    case path === 'studentHealthAPI': return finish(200, ok(dataOr(FIX.health(), [])));
    case path === 'studentInfirmaryAPI': return finish(200, okCode(dataOr(FIX.infirmary(), [])));
    case path === 'consentListAPI': return finish(200, okCode(dataOr(FIX.consent(), [])));
    case path === 'studentTransportAPI': return finish(200, ok(dataOr(FIX.transport(), [])));
    case path === 'studentCertificateAPI': return finish(200, okCode(dataOr(FIX.certificates(), [])));
    case path === 'studentDisciplineAPI': return finish(200, ok(dataOr(FIX.discipline(), [])));
    case path === 'schoolDetailAPI': return finish(200, ok(dataOr(FIX.school(body.action), [])));
    case path === 'studentPhotoVideoGalleryAPI': return finish(200, empty ? { status: 0, message: 'No Data Found' } : ok(FIX.gallery(body.action)));
    case path === 'api/lms/social-collaborative': {
      // the mock honours mine=1 exactly like the real endpoint: it only ever returns the caller's own discussions
      if (u.searchParams.get('mine') !== '1') return finish(400, { success: false, message: 'mock: the app must send mine=1' });
      return finish(200, okModern(dataOr(FIX.discussions(), []), { current_page: 1, per_page: 50, total: 2, last_page: 1 }));
    }
    case /^api\/lms\/social-collaborative\/\d+$/.test(path): {
      const d = FIX.discussionDetail(path.split('/').pop());
      return d && !empty ? finish(200, okModern(d)) : finish(404, { success: false, message: 'This discussion is not available.', data: null, errors: null });
    }
    case path === 'api/own-profile': {
      if (mode === '404' || empty) return finish(404, { success: false, message: 'Profile not found.', data: null });
      const base = { id: 900001, full_name: 'Demo Student', email: 'student@demo.test', mobile: '0000000010', birthdate: '2013-05-17', join_year: 2019, address: '12 Demo Road, Fabricated City', image: 'x.jpg', user_profile: 'Student', school_name: SCHOOL };
      if (who === 'teacher') Object.assign(base, { id: 900002, full_name: 'Demo Teacher', email: 'teacher@demo.test', join_year: 2015, user_profile: 'Teacher' });
      // a "wrong person" record: the cross-check in the app must reject it and show nothing from it
      if (who === 'mismatch') Object.assign(base, { id: 900003, full_name: 'Someone Else Entirely', email: 'someone.else@demo.test', mobile: '0000000099', address: 'Secret Fabricated Street 9', birthdate: '1980-01-01', join_year: 1999 });
      return finish(200, okModern(base));
    }
    default:
      return finish(404, legacy ? { status: 0, message: 'mock: unknown endpoint' } : { success: false, message: 'mock: unknown endpoint' });
  }
}

function record(entry) {
  state.log.push(entry);
  if (LOG_FILE) { try { fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n'); } catch (e) { /* ignore */ } }
}

function audit() {
  const appCalls = state.log.filter((e) => !e.isControl);
  const byPath = {};
  appCalls.forEach((e) => { const k = `${e.method} ${e.path}`; byPath[k] = (byPath[k] || 0) + 1; });
  return {
    totalRequests: appCalls.length,
    byPath,
    unexpected: appCalls.filter((e) => !e.allowed).map((e) => `${e.method} ${e.path}`),
    tokenInUrl: appCalls.filter((e) => e.tokenInUrl).map((e) => `${e.method} ${e.path}`),
    nonGetWithoutAuth: appCalls.filter((e) => !e.isStatic && e.path !== 'api/api-login' && !e.bearer).map((e) => `${e.method} ${e.path}`),
    staticFileRequestsWithAuthHeaderOrToken: appCalls.filter((e) => e.isStatic && (e.bearer || e.tokenInUrl)).map((e) => e.path),
    writeLikeMethods: appCalls.filter((e) => !['GET', 'POST'].includes(e.method)).map((e) => `${e.method} ${e.path}`),
  };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try { handle(req, res, Buffer.concat(chunks).toString('utf8')); } catch (e) { send(res, 500, { error: String(e && e.message) }); }
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`mock-api (fabricated data only) listening on http://127.0.0.1:${PORT}`));
