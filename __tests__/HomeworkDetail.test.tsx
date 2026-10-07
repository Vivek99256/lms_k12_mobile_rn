import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { HomeworkDetail as Data, HomeworkSubmission } from '../src/api/student';
import { HomeworkDetail } from '../src/screens/student/HomeworkDetail';
import { makeClient, renderWith, signIn } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchHomeworkDetail: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchHomeworkDetail } = require('../src/api/student') as { fetchHomeworkDetail: jest.Mock };

const submission = (over: Partial<HomeworkSubmission> = {}): HomeworkSubmission => ({
  status: 'Submitted',
  submittedAt: '2026-10-08',
  remarks: '',
  teacherRemarks: '',
  aiStatus: '',
  aiScore: null,
  aiTotal: null,
  aiPercentage: null,
  feedbackPublished: false,
  files: [],
  ...over,
});

const data = (over: Partial<Data> = {}): Data => ({
  id: '5',
  title: 'Fractions',
  description: 'Do page 4',
  subject: 'Maths',
  standard: '7',
  division: 'A',
  date: '2026-10-01',
  dueDate: '2026-10-12',
  teacher: 'Mrs Shah',
  referenceUrl: '',
  questions: [],
  submission: null,
  ...over,
});

let client = makeClient();
const ui = (id = '5') => renderWith(client, <HomeworkDetail id={id} />);
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchHomeworkDetail.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('HomeworkDetail - content', () => {
  it('shows teacher, class, instructions and the not-submitted note', async () => {
    fetchHomeworkDetail.mockResolvedValue(data());
    await ui();
    expect(await screen.findByText('Do page 4')).toBeTruthy();
    expect(screen.getByText(/Teacher: Mrs Shah/)).toBeTruthy();
    expect(screen.getByText(/7 · A/)).toBeTruthy();
    expect(screen.getByText("You haven't submitted this homework yet.")).toBeTruthy();
    expect(fetchHomeworkDetail).toHaveBeenCalledWith('5');
  });

  it('says so when there are no instructions', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ description: '   ' }));
    await ui();
    expect(await screen.findByText('No instructions provided.')).toBeTruthy();
  });

  it('makes only http(s) links in the instructions tappable (S1 link validation)', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ description: 'Watch https://school.example/video then javascript:alert(1) and tel:+911234567890' }));
    await ui();
    const links = await screen.findAllByRole('link');
    expect(links).toHaveLength(1);
    await fireEvent.press(links[0]);
    expect(openURL).toHaveBeenCalledWith('https://school.example/video');
  });

  it('never makes a link of credentials-in-URL or file/intent schemes', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ description: 'https://erp.triz.co.in@evil.example/x intent://x file:///etc/passwd' }));
    await ui();
    await screen.findByText(/intent:\/\/x/);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('HomeworkDetail - questions: HTML to plain text', () => {
  it('shows question text as plain text with marks, never as markup', async () => {
    fetchHomeworkDetail.mockResolvedValue(
      data({
        questions: [
          { id: '1', title: '<p>What is <b>2+2</b>?</p>', description: '', points: 2 },
          { id: '2', title: '', description: '<div>Describe &amp; explain<br>the water cycle</div>', points: 1 },
          { id: '3', title: '&lt;script&gt;alert(1)&lt;/script&gt;', description: '', points: null },
          { id: '4', title: '<script>evil()</script>', description: '', points: 1.5 },
        ],
      }),
    );
    await ui();
    expect(await screen.findByText('1. What is 2+2?')).toBeTruthy();
    expect(screen.getByText('2 marks')).toBeTruthy();
    expect(screen.getByText(/2\. Describe & explain\s+the water cycle/)).toBeTruthy(); // falls back to the description (RNTL collapses the line break)
    expect(screen.getByText('1 mark')).toBeTruthy();
    expect(screen.getByText('3. <script>alert(1)</script>')).toBeTruthy(); // encoded text stays visible text
    expect(screen.getByText('4. Question 4')).toBeTruthy(); // nothing left after stripping the script
    expect(screen.getByText('1.5 marks')).toBeTruthy();
    expect(screen.queryByText(/evil\(\)/)).toBeNull();
    expect(screen.queryByText(/<p>|<b>|<div>/)).toBeNull();
  });
});

describe('HomeworkDetail - the teacher\'s attachment (file-link validation)', () => {
  it('opens an attachment from an ERP host, re-based onto the configured API host', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ referenceUrl: 'https://erp.triz.co.in/storage/student/a.pdf' }));
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/student/a.pdf');
  });

  it('keeps a link that already points at the API host', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ referenceUrl: 'https://dev.triz.co.in/storage/student/a.pdf' }));
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/student/a.pdf');
  });

  it('shows no button for a foreign host, look-alike, credentials, bare name, empty value or non-http scheme', async () => {
    for (const bad of ['https://evil.example/a.pdf', 'https://erp.triz.co.in.evil.com/a.pdf', 'https://erp.triz.co.in@evil.example/a.pdf', 'a.pdf', '', 'javascript:alert(1)', 'file:///etc/passwd']) {
      fetchHomeworkDetail.mockResolvedValue(data({ referenceUrl: bad }));
      const c = makeClient();
      const view = await renderWith(c, <HomeworkDetail id="5" />);
      await screen.findByText('Do page 4');
      expect(screen.queryByText('Open attachment')).toBeNull();
      await view.unmount();
    }
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('HomeworkDetail - your submission', () => {
  it('shows status, date, your note and your files, with Open only for acceptable file links', async () => {
    fetchHomeworkDetail.mockResolvedValue(
      data({
        submission: submission({
          remarks: 'Done, see photos',
          files: [
            { id: '5_0', name: 'page4.jpg', url: 'https://erp.triz.co.in/storage/homework/page4.jpg' },
            { id: '5_1', name: 'evil.pdf', url: 'https://evil.example/evil.pdf' },
            { id: '5_2', name: '', url: '' },
          ],
        }),
      }),
    );
    await ui();
    expect(await screen.findByLabelText('Status: Awaiting review')).toBeTruthy();
    expect(screen.getByText('Submitted 8 Oct 2026')).toBeTruthy();
    expect(screen.getByText('Done, see photos')).toBeTruthy();
    expect(screen.getByText('page4.jpg')).toBeTruthy();
    expect(screen.getByText('evil.pdf')).toBeTruthy(); // the name is shown, but there is no way to open a foreign link
    expect(screen.getByText('Submitted file')).toBeTruthy();
    const open = screen.getAllByText('Open file');
    expect(open).toHaveLength(1);
    await fireEvent.press(open[0]);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/homework/page4.jpg');
  });

  it('an empty submission status is shown as submitted (the old flow), not as missing', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ submission: submission({ status: '' }) }));
    await ui();
    expect(await screen.findByLabelText('Status: Awaiting review')).toBeTruthy();
  });
});

describe('HomeworkDetail - teacher remarks visibility', () => {
  it('shows the teacher remarks when feedback is published', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ submission: submission({ status: 'Reviewed', teacherRemarks: 'Well done', feedbackPublished: true }) }));
    await ui();
    expect(await screen.findByText('Teacher remarks')).toBeTruthy();
    expect(screen.getByText('Well done')).toBeTruthy();
    expect(screen.getByLabelText('Status: Reviewed')).toBeTruthy();
  });

  it('hides the teacher remarks while feedback is not published', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ submission: submission({ status: 'Under Review', teacherRemarks: 'Draft comment', feedbackPublished: false }) }));
    await ui();
    await screen.findByText('Do page 4');
    expect(screen.queryByText('Teacher remarks')).toBeNull();
    expect(screen.queryByText('Draft comment')).toBeNull();
  });

  it('hides the box when feedback is published but the remarks are empty', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ submission: submission({ status: 'Reviewed', teacherRemarks: '  ', feedbackPublished: true }) }));
    await ui();
    await screen.findByText('Do page 4');
    expect(screen.queryByText('Teacher remarks')).toBeNull();
  });
});

describe('HomeworkDetail - AI score visibility (S4a-D6)', () => {
  const withAi = (aiStatus: string, extra: Partial<HomeworkSubmission> = {}) => data({ submission: submission({ aiStatus, aiScore: 8, aiTotal: 10, aiPercentage: 80, ...extra }) });

  it('shows "AI score: 8 / 10 (80%)" when the homework has been evaluated', async () => {
    fetchHomeworkDetail.mockResolvedValue(withAi('Evaluated'));
    await ui();
    expect(await screen.findByText('AI score: 8 / 10 (80%)')).toBeTruthy();
  });

  it('is case-insensitive and shows the score even before the teacher publishes feedback (as the web does)', async () => {
    fetchHomeworkDetail.mockResolvedValue(withAi(' evaluated ', { feedbackPublished: false }));
    await ui();
    expect(await screen.findByText('AI score: 8 / 10 (80%)')).toBeTruthy();
  });

  it('copes with missing parts of the score', async () => {
    fetchHomeworkDetail.mockResolvedValue(data({ submission: submission({ aiStatus: 'Evaluated', aiScore: null, aiTotal: null, aiPercentage: null }) }));
    await ui();
    expect(await screen.findByText('AI score: -')).toBeTruthy();
  });

  it('does not show the score when it is not evaluated: no AI status, checking, or failed', async () => {
    for (const status of ['', 'Checking', 'OCR Failed', 'Evaluation Failed', 'Failed', 'something']) {
      fetchHomeworkDetail.mockResolvedValue(withAi(status));
      const c = makeClient();
      const view = await renderWith(c, <HomeworkDetail id="5" />);
      await screen.findByText('Do page 4');
      expect(screen.queryByText(/AI score/)).toBeNull();
      await view.unmount();
    }
  });

  it('says the AI is checking while it checks, without any score', async () => {
    fetchHomeworkDetail.mockResolvedValue(withAi('Checking'));
    await ui();
    expect(await screen.findByText('AI is checking this submission…')).toBeTruthy();
    expect(screen.queryByText(/AI score/)).toBeNull();
  });

  it('does not show a score when the student has not submitted', async () => {
    fetchHomeworkDetail.mockResolvedValue(data());
    await ui();
    await screen.findByText('Do page 4');
    expect(screen.queryByText(/AI score/)).toBeNull();
  });
});

describe('HomeworkDetail - errors, loading, stale and guards', () => {
  it('shows a 404 with its message and Try again, and retries', async () => {
    fetchHomeworkDetail.mockRejectedValueOnce(new ApiError('server', 'Homework not found', 404));
    await ui();
    expect(await screen.findByText('Homework not found')).toBeTruthy();
    fetchHomeworkDetail.mockResolvedValueOnce(data());
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Do page 4')).toBeTruthy();
    expect(fetchHomeworkDetail).toHaveBeenCalledTimes(2);
  });

  it('shows the 403 "not yours" message', async () => {
    fetchHomeworkDetail.mockRejectedValue(new ApiError('forbidden', 'You are not allowed to view this homework.', 403));
    await ui();
    expect(await screen.findByText('You are not allowed to view this homework.')).toBeTruthy();
  });

  it('shows 401 authentication failures as an error with Try again', async () => {
    fetchHomeworkDetail.mockRejectedValue(new ApiError('unauthorized', 'Authentication required', 401));
    await ui();
    expect(await screen.findByText('Authentication required')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('shows inline loading text', async () => {
    fetchHomeworkDetail.mockReturnValue(new Promise(() => {}));
    await ui();
    expect(screen.getByText('Loading details…')).toBeTruthy();
  });

  it('keeps the last details with a notice when a refresh fails', async () => {
    client.setQueryData(['student-homework-detail', 123, '2026', '5'], data(), { updatedAt: 0 });
    fetchHomeworkDetail.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded details/)).toBeTruthy();
    expect(screen.getByText('Do page 4')).toBeTruthy();
  });

  it('never opens an id that is not plain digits, and makes no request', async () => {
    for (const bad of ['abc', '1/2', '../1', '12;', '']) {
      const c = makeClient();
      const view = await renderWith(c, <HomeworkDetail id={bad} />);
      expect(screen.getByText('Details are not available for this item.')).toBeTruthy();
      await view.unmount();
    }
    expect(fetchHomeworkDetail).not.toHaveBeenCalled();
  });

  it('renders nothing and makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.queryByText('Loading details…')).toBeNull();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(fetchHomeworkDetail).not.toHaveBeenCalled();
  });

  it('keeps each homework\'s details in its own cache entry, per user', async () => {
    client.setQueryData(['student-homework-detail', 999, '2026', '5'], data({ description: 'SECRET OF 999' }));
    fetchHomeworkDetail.mockResolvedValue(data());
    await ui();
    await screen.findByText('Do page 4');
    expect(screen.queryByText('SECRET OF 999')).toBeNull();
  });
});
