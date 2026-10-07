import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { EmptyState, ErrorState, Loading } from '../components/ui';
import { userMessage } from '../api/errors';
import { useBootstrap } from '../hooks/useBootstrap';
import { canAccessScreen } from '../rbac/permissions';
import { screenRegistry } from '../screens/registry';
import { GenericDataScreen } from '../screens/shared/GenericDataScreen';
import { WebHandoffScreen } from '../screens/shared/WebHandoffScreen';
import { RootStackParams } from './types';

/**
 * Single entry point for every menu tile. Authorization happens HERE, by key, against the
 * backend-supplied permission snapshot, so navigating to a key the user does not hold
 * (deep link, stale route, tampering) renders "no access" instead of the screen.
 */
export function TileScreen({ route }: NativeStackScreenProps<RootStackParams, 'Tile'>) {
  const { key } = route.params;
  const { menu, permissions, isLoading, isError, error, refetch } = useBootstrap();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={userMessage(error)} onRetry={() => void refetch()} />;

  const tile = menu.tiles.get(key);
  if (!tile || !canAccessScreen(permissions, key)) {
    return <EmptyState title="No access" hint="Your role does not include this screen." />;
  }

  if (tile.renderType === 'webview' && tile.webUrl) {
    // Pages from the retired web page builder no longer exist on the web app.
    if (/\/mobile\/custom\//i.test(tile.webUrl)) {
      return <EmptyState title="Not available in the app" hint="This page has moved. Ask your administrator." />;
    }
    return <WebHandoffScreen tile={tile} />;
  }

  const Dedicated = tile.screenName ? screenRegistry[tile.screenName] : undefined;
  if (Dedicated) return <Dedicated tile={tile} />;
  if (tile.api) return <GenericDataScreen tile={tile} />;
  return <EmptyState title="Coming soon" hint="This screen is not available in the app yet." />;
}
