import { screen } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { screenRegistry } from '../src/screens/registry';
import { RecordUnavailableScreen } from '../src/screens/student/RecordUnavailableScreen';
import { makeClient, renderWith, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

const srcDir = path.join(__dirname, '..', 'src');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Learn and Live Lecture tiles', () => {
  it.each([
    ['lms_subject', 'https://erp.triz.co.in/studentSubjectAPI'],
    ['live_lecture', 'https://erp.triz.co.in'],
  ])('%s shows "This isn\'t available in the app yet." / "Please ask your school." and makes no request of any kind', async (screenName, api) => {
    const fetchSpy = jest.fn();
    (global as { fetch: unknown }).fetch = fetchSpy;
    const Screen = screenRegistry[screenName];
    expect(Screen).toBe(RecordUnavailableScreen);
    const r = await renderWith(makeClient(), <Screen tile={{ ...tile(screenName), api }} />);
    expect(screen.getByText("This isn't available in the app yet.")).toBeTruthy();
    expect(screen.getByText('Please ask your school.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await r.unmount();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the app code never reaches the Learn content endpoint, a legacy LMS endpoint, or a write / broad social route', () => {
  const files = walk(srcDir);
  const code = files.map((f) => ({ f: path.relative(srcDir, f), src: stripComments(fs.readFileSync(f, 'utf8')) }));

  it.each(['studentContentAPI', 'studentSubjectAPI', 'studentSocialCollabrativeAPI', 'studentVirtualClassroomAPI', 'studentPortfolioAPI', 'studentLeaderBoardAPI', 'studentQuestionPaper', 'studentAssessment', 'studentActivityStream', 'lms-chapter', 'lms-courses'])(
    'no source file mentions %s in code',
    (needle) => {
      expect(code.filter((c) => c.src.includes(needle)).map((c) => c.f)).toEqual([]);
    },
  );

  it('the social-collaborative path appears only in the two GET fetchers, and the list is always requested with mine: 1', () => {
    const hits = code.filter((c) => c.src.includes('lms/social-collaborative'));
    expect(hits.map((h) => h.f)).toEqual([path.join('api', 'student.ts')]);
    // Only the S8a block of the file is examined (the rest of the file belongs to other modules).
    const whole = hits[0].src;
    const src = whole.slice(whole.indexOf('const DISCUSSIONS_PAGE_SIZE'));
    const uses = src.match(/api\.(get|post)<unknown>\(\s*[`'"]api\/lms\/social-collaborative[^]*?\)/g) ?? [];
    expect(uses).toHaveLength(2);
    expect(uses.every((u) => u.startsWith('api.get'))).toBe(true);
    expect(src).toMatch(/query: \{ mine: 1, per_page: DISCUSSIONS_PAGE_SIZE, page \}/);
    // No request in the block ever sets a query that could widen the feed.
    expect(src).not.toMatch(/query: \{[^}]*\b(visibility|search|subject_id|chapter_id)\b/);
    expect(src).not.toMatch(/mine: 0|mine: false/);
  });
});
