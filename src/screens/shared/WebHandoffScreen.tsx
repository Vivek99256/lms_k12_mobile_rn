import { useMutation } from '@tanstack/react-query';
import React from 'react';
import { Linking, Text, View } from 'react-native';
import { api } from '../../api/client';
import { userMessage } from '../../api/errors';
import { Button, ErrorState, Page, styles } from '../../components/ui';
import { MenuTile } from '../../menu/types';

/**
 * Menu rows with render_type=webview open an ERP web page already signed in, through the
 * backend's single-use handoff ticket (POST /api/mobile/web-handoff). Opened in the system
 * browser so no native WebView module is needed (keeps this feature OTA-deliverable).
 */
export function WebHandoffScreen({ tile }: { tile: MenuTile }) {
  const open = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('api/mobile/web-handoff', { body: { web_url: tile.webUrl } });
      if (!res.data?.url) throw new Error('No link was returned.');
      await Linking.openURL(res.data.url);
    },
  });

  return (
    <Page>
      <View style={[styles.center, { gap: 16 }]}>
        <Text style={styles.emptyTitle}>{tile.title}</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>This page opens in your browser, already signed in.</Text>
        {open.isError ? <ErrorState message={userMessage(open.error)} /> : null}
        <Button title="Open page" loading={open.isPending} onPress={() => open.mutate()} />
      </View>
    </Page>
  );
}
