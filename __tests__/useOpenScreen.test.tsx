import { renderHook } from '@testing-library/react-native';
import { MenuTile } from '../src/menu/types';
import { useOpenScreen } from '../src/navigation/useOpenScreen';
import { tile } from './helpers/kit';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
let mockTiles: MenuTile[] = [];
jest.mock('../src/hooks/useBootstrap', () => ({
  useBootstrap: () => ({ menu: { sections: [], tiles: new Map(mockTiles.map((t) => [t.key, t])) } }),
}));

beforeEach(() => {
  mockNavigate.mockReset();
  mockTiles = [tile('circular_events', 'Circular & Events'), tile('home_work', 'Homework')];
});

describe('useOpenScreen', () => {
  it('canOpen is true only for screens the backend listed for this user', async () => {
    const { result } = await renderHook(() => useOpenScreen());
    expect(result.current.canOpen('circular_events')).toBe(true);
    expect(result.current.canOpen('fees')).toBe(false);
  });

  it('open navigates to the Tile route with the tile key and title', async () => {
    const { result } = await renderHook(() => useOpenScreen());
    result.current.open('home_work');
    expect(mockNavigate).toHaveBeenCalledWith('Tile', { key: 'section/home_work', title: 'Homework' });
  });

  it('open does nothing for a screen that is not in the menu (RBAC is not bypassed)', async () => {
    const { result } = await renderHook(() => useOpenScreen());
    result.current.open('fees');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
