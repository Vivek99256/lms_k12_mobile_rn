import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useBootstrap } from '../hooks/useBootstrap';
import { RootStackParams } from './types';

/**
 * Opens a menu tile by its backend `screen_name` - only if the backend listed that tile for this user.
 * `canOpen` lets a "View all" link hide itself when the tile is not in the user's menu; `TileScreen`
 * still re-checks access when the route opens, so RBAC is unchanged.
 */
export function useOpenScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { menu } = useBootstrap();
  const tiles = useMemo(() => [...menu.tiles.values()], [menu]);
  const find = useCallback((screenName: string) => tiles.find((t) => t.screenName === screenName), [tiles]);
  return {
    canOpen: (screenName: string) => !!find(screenName),
    open: (screenName: string) => {
      const t = find(screenName);
      if (t) nav.navigate('Tile', { key: t.key, title: t.title });
    },
  };
}
