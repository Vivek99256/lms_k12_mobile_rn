import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DayChip, DayStrip } from '../src/components/DayStrip';

const chips: DayChip[] = [
  { key: 'Mon', label: 'Mon', name: 'Monday', hasItems: true, isToday: false },
  { key: 'Tue', label: 'Tue', name: 'Tuesday', hasItems: false, isToday: true },
  { key: 'Other', label: 'Other', name: 'Other days', hasItems: true, isToday: false },
];

describe('DayStrip', () => {
  it('renders every chip as a tab with a spoken name, "today" and "nothing scheduled"', async () => {
    await render(<DayStrip chips={chips} selected="Mon" onSelect={jest.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Monday', 'Tuesday, today, nothing scheduled', 'Other days']);
  });

  it('marks only the selected chip as selected', async () => {
    await render(<DayStrip chips={chips} selected="Tue" onSelect={jest.fn()} />);
    const states = screen.getAllByRole('tab').map((t) => t.props.accessibilityState.selected);
    expect(states).toEqual([false, true, false]);
  });

  it('calls onSelect with the chip key', async () => {
    const onSelect = jest.fn();
    await render(<DayStrip chips={chips} selected="Mon" onSelect={onSelect} />);
    await fireEvent.press(screen.getByLabelText('Other days'));
    expect(onSelect).toHaveBeenCalledWith('Other');
    await fireEvent.press(screen.getByLabelText('Tuesday, today, nothing scheduled'));
    expect(onSelect).toHaveBeenLastCalledWith('Tue');
  });

  it('keeps every chip at least 44 dp in both directions', async () => {
    await render(<DayStrip chips={chips} selected="Mon" onSelect={jest.fn()} />);
    for (const t of screen.getAllByRole('tab')) {
      const style = StyleSheet.flatten(t.props.style) as { minHeight: number; minWidth: number };
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });

  it('renders nothing selectable for an empty list', async () => {
    await render(<DayStrip chips={[]} selected="Mon" onSelect={jest.fn()} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
