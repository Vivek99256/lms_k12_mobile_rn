import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import React from 'react';
import { useAuthStore } from '../../src/auth/authStore';
import { AuthUser } from '../../src/auth/types';
import { MenuTile } from '../../src/menu/types';

/** A student session as the login would store it. */
export const studentUser: AuthUser = {
  id: 123,
  email: 's@example.com',
  name: 'Test Student',
  subInstituteId: 7,
  userProfileId: 3,
  userProfileName: 'Student',
  isAdmin: 0,
  isStudent: true,
  clientId: null,
  syear: '2026',
  schoolName: 'School',
};

export const signIn = (user: Partial<AuthUser> = {}) =>
  useAuthStore.setState({ status: 'signedIn', token: 'jwt', user: { ...studentUser, ...user } });

export const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

export const renderWith = (client: QueryClient, ui: React.ReactElement) =>
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

export const tile = (screenName: string, title = screenName): MenuTile => ({
  key: `section/${screenName}`,
  title,
  section: 'Section',
  icon: null,
  api: null,
  apiParam: null,
  screenName,
  renderType: 'native',
  webUrl: null,
  openMode: 'in_app',
});

/** Pins "today" to 7 October 2026 (device local time). Only Date is faked: timers stay real for react-query. */
export function pinToday() {
  jest.useFakeTimers({
    now: new Date(2026, 9, 7, 12, 0, 0),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
  });
}
