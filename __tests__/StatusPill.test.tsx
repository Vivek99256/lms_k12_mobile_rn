import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusPill } from '../src/components/StatusPill';

const bg = (label: string) => {
  const el = screen.getByLabelText(`Status: ${label}`);
  return (StyleSheet.flatten(el.props.style) as { backgroundColor: string }).backgroundColor;
};

describe('StatusPill', () => {
  it('shows the status word and announces it', async () => {
    await render(<StatusPill label="Reviewed" tone="success" />);
    expect(screen.getByText('Reviewed')).toBeTruthy();
    expect(screen.getByLabelText('Status: Reviewed')).toBeTruthy();
  });

  it('uses a different tint per tone, and neutral by default', async () => {
    await render(
      <>
        <StatusPill label="A" />
        <StatusPill label="B" tone="info" />
        <StatusPill label="C" tone="success" />
        <StatusPill label="D" tone="warning" />
        <StatusPill label="E" tone="danger" />
      </>,
    );
    const tints = ['A', 'B', 'C', 'D', 'E'].map(bg);
    expect(new Set(tints).size).toBe(5);
    expect(bg('A')).toBe(bg('A'));
  });
});
