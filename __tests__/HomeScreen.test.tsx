import { act, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from '../src/screens/HomeScreen';
import { makeClient, renderWith, signIn } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
// Icons are irrelevant here, and @expo/vector-icons cannot load under Jest in this install
// (expo-font cannot resolve expo-asset, which npm left nested under node_modules/expo).
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const mockRefetch = jest.fn();
let mockRole = 'Student';
jest.mock('../src/hooks/useBootstrap', () => ({
  useBootstrap: () => ({
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
    menu: { sections: [], tiles: new Map() },
    permissions: { roleName: mockRole },
  }),
}));
jest.mock('../src/screens/student/StudentDashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { StudentDashboard: () => R.createElement(Text, null, 'STUDENT_DASHBOARD') };
});
// The generic dashboard body uses animated counters that keep running after a test ends; its content is not under test.
jest.mock('../src/components/DataView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { DataView: () => R.createElement(Text, null, 'GENERIC_DASHBOARD_DATA') };
});
jest.mock('../src/api/client', () => ({ ...jest.requireActual('../src/api/client'), callAuto: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { callAuto } = require('../src/api/client') as { callAuto: jest.Mock };

let client = makeClient();
const ui = () =>
  renderWith(
    client,
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <HomeScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  client = makeClient();
  callAuto.mockReset();
  callAuto.mockResolvedValue({ data: { total_classes: 4 }, raw: {}, message: '' });
  mockRefetch.mockReset();
  mockRole = 'Student';
});

describe('HomeScreen dashboard section (S1-D1)', () => {
  it('a student gets the purpose-built dashboard and the generic summary is not requested', async () => {
    signIn();
    await ui();
    expect(await screen.findByText('STUDENT_DASHBOARD')).toBeTruthy();
    expect(callAuto).not.toHaveBeenCalled();
  });

  it('a teacher keeps the generic dashboard exactly as before', async () => {
    mockRole = 'Teacher';
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(await screen.findByText('GENERIC_DASHBOARD_DATA')).toBeTruthy();
    expect(screen.getByText('Your day at a glance')).toBeTruthy();
    expect(callAuto).toHaveBeenCalledWith('teacher-dashboard/summary');
    expect(screen.queryByText('STUDENT_DASHBOARD')).toBeNull();
  });

  it('an admin keeps the generic dashboard too', async () => {
    mockRole = 'Admin';
    signIn({ isStudent: false, userProfileName: 'Admin' });
    await ui();
    await screen.findByText('GENERIC_DASHBOARD_DATA');
    expect(callAuto).toHaveBeenCalledWith('admin-dashboard/summary');
    expect(screen.queryByText('STUDENT_DASHBOARD')).toBeNull();
  });

  it('pull-to-refresh refreshes the menu and both dashboard queries', async () => {
    signIn();
    const spy = jest.spyOn(client, 'invalidateQueries');
    await ui();
    await screen.findByText('STUDENT_DASHBOARD');
    // The pull gesture ends in the RefreshControl's onRefresh; call it the way the native control does.
    await act(async () => {
      const control = screen.container.queryAll((n) => n.type === 'RCTRefreshControl')[0];
      // RNTL hides function props on host elements, so walk up the React fibers to the RefreshControl element
      // (test-only) and call the onRefresh the screen passed to it.
      type Fiber = { memoizedProps?: { onRefresh?: () => void }; return: Fiber | null };
      let fiber = (control as unknown as { unstable_fiber: Fiber | null }).unstable_fiber;
      while (fiber && typeof fiber.memoizedProps?.onRefresh !== 'function') fiber = fiber.return;
      fiber?.memoizedProps?.onRefresh?.();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toEqual(expect.arrayContaining(['["student-dashboard"]', '["dashboard"]']));
  });
});
