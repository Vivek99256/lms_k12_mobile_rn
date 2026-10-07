import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { FeeSummary } from '../src/api/student';
import { FeesSummaryScreen } from '../src/screens/student/FeesSummaryScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchFeeSummary: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchFeeSummary } = require('../src/api/student') as { fetchFeeSummary: jest.Mock };

const sum = (total: number, paid: number, unpaid = total - paid): FeeSummary => ({ total, paid, unpaid });

let client = makeClient();
const ui = () => renderWith(client, <FeesSummaryScreen tile={tile('fees')} />);

beforeEach(() => {
  client = makeClient();
  fetchFeeSummary.mockReset();
  signIn();
});

describe('FeesSummaryScreen - content', () => {
  it('shows loading first, then the three whole-year figures labelled as such', async () => {
    fetchFeeSummary.mockResolvedValue(sum(125000, 80000));
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Total fees for the year')).toBeTruthy();
    expect(screen.getByText('₹1,25,000')).toBeTruthy();
    expect(screen.getByText('Paid (includes any discounts)')).toBeTruthy();
    expect(screen.getByText('₹80,000')).toBeTruthy();
    expect(screen.getAllByText('₹45,000')).toHaveLength(2); // headline + Pending row
    expect(screen.getByText('Pending fees (whole-year balance)')).toBeTruthy();
    expect(screen.getByText(/School year 2026 · whole-year totals/)).toBeTruthy();
    expect(screen.getByText(/Paid 64% of ₹1,25,000/)).toBeTruthy();
    expect(fetchFeeSummary).toHaveBeenCalledTimes(1);
  });

  it('does not claim to be real-time and says what is not in the app', async () => {
    fetchFeeSummary.mockResolvedValue(sum(1000, 0));
    await ui();
    await screen.findByText('Total fees for the year');
    expect(screen.getByText(/not guaranteed to be real-time/)).toBeTruthy();
    expect(screen.getByText(/Month-wise dues, receipts and online payment are not in the app yet/)).toBeTruthy();
  });

  it('one accessible sentence carries the figures', async () => {
    fetchFeeSummary.mockResolvedValue(sum(125000, 80000));
    await ui();
    await screen.findByText('Total fees for the year');
    expect(screen.getByLabelText('Total ₹1,25,000. Paid ₹80,000, 64 percent. Pending ₹45,000.')).toBeTruthy();
  });

  it('fully paid: "No pending fees" and no bar shortfall', async () => {
    fetchFeeSummary.mockResolvedValue(sum(5000, 5000));
    await ui();
    expect(await screen.findByText('No pending fees')).toBeTruthy();
    expect(screen.getByText(/Paid 100% of ₹5,000/)).toBeTruthy();
  });

  it('overpaid: pending shown as zero and the excess as paid in advance', async () => {
    fetchFeeSummary.mockResolvedValue(sum(5000, 6200));
    await ui();
    expect(await screen.findByText('Paid in advance ₹1,200')).toBeTruthy();
    expect(screen.getByText('No pending fees')).toBeTruthy();
    expect(screen.getByText('₹0')).toBeTruthy(); // the Pending row
    expect(screen.queryByText(/-₹/)).toBeNull();
  });

  it('keeps paise and Indian grouping', async () => {
    fetchFeeSummary.mockResolvedValue(sum(1234567.5, 234567.25));
    await ui();
    expect(await screen.findByText('₹12,34,567.50')).toBeTruthy();
    expect(screen.getByText('₹2,34,567.25')).toBeTruthy();
  });

  it('has no payment, receipt or link control of any kind', async () => {
    fetchFeeSummary.mockResolvedValue(sum(125000, 80000));
    await ui();
    await screen.findByText('Total fees for the year');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText(/pay now|receipt(?!s)|download|pay online/i)).toBeNull();
  });
});

describe('FeesSummaryScreen - empty and error states', () => {
  it('no fee data for the year -> an empty state, no figures', async () => {
    fetchFeeSummary.mockResolvedValue(null);
    await ui();
    expect(await screen.findByText('No fee details for school year 2026 yet')).toBeTruthy();
    expect(screen.queryByText('Total fees for the year')).toBeNull();
  });

  it('the known backend 500 -> a friendly message without a claimed cause, no figures, Try again works', async () => {
    fetchFeeSummary.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText(/The fees summary could not be loaded right now/)).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(fetchFeeSummary).toHaveBeenCalledTimes(1); // no automatic retry
    fetchFeeSummary.mockResolvedValueOnce(sum(1000, 250));
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findAllByText('₹750')).toHaveLength(2);
    expect(fetchFeeSummary).toHaveBeenCalledTimes(2);
  });

  it('academic year missing (422) shows the server message', async () => {
    fetchFeeSummary.mockRejectedValue(new ApiError('validation', 'Academic Term Date Expired', 422));
    await ui();
    expect(await screen.findByText('Academic Term Date Expired')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('401 shows an error state (the client signs the user out)', async () => {
    fetchFeeSummary.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a network error shows its own message and retry', async () => {
    fetchFeeSummary.mockRejectedValue(new ApiError('network', 'No internet connection.'));
    await ui();
    expect(await screen.findByText('No internet connection.')).toBeTruthy();
  });

  it('a synthetic / invalid student the server does not know -> the same empty state', async () => {
    signIn({ id: 999999999 });
    fetchFeeSummary.mockResolvedValue(null);
    await ui();
    expect(await screen.findByText('No fee details for school year 2026 yet')).toBeTruthy();
  });

  it('unreadable amounts from the server (parse error) are an error, never zero', async () => {
    fetchFeeSummary.mockRejectedValue(new ApiError('server', 'The fees summary has an unexpected format.'));
    await ui();
    expect(await screen.findByText('The fees summary has an unexpected format.')).toBeTruthy();
    expect(screen.queryByText('₹0')).toBeNull();
  });
});

describe('FeesSummaryScreen - cache, stale data and guards', () => {
  it('a failed refresh keeps the figures and shows the stale banner', async () => {
    fetchFeeSummary.mockResolvedValueOnce(sum(1000, 250));
    await ui();
    await screen.findByText('Total fees for the year');
    fetchFeeSummary.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('₹1,000')).toBeTruthy();
  });

  it('a non-student sees "Students only" and no request is made', async () => {
    signIn({ isStudent: false });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchFeeSummary).not.toHaveBeenCalled();
  });

  it('no school year -> "School year not set" and no request is made', async () => {
    signIn({ syear: '' });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchFeeSummary).not.toHaveBeenCalled();
  });

  it('cached per user: another student never sees the first student\'s figures', async () => {
    fetchFeeSummary.mockResolvedValueOnce(sum(1000, 250));
    const first = await ui();
    await screen.findByText('₹1,000');
    first.unmount();
    signIn({ id: 456 });
    fetchFeeSummary.mockResolvedValueOnce(sum(2000, 500));
    await ui();
    expect(await screen.findByText('₹2,000')).toBeTruthy();
    expect(screen.queryByText('₹1,000')).toBeNull();
    expect(fetchFeeSummary).toHaveBeenCalledTimes(2);
  });
});
