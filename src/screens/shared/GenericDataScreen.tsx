import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { callAuto } from '../../api/client';
import { userMessage } from '../../api/errors';
import { DataView } from '../../components/DataView';
import { ErrorState, Loading, Page } from '../../components/ui';
import { MenuTile } from '../../menu/types';
import { parseApiParam } from '../../utils/helpers';

/** Fallback for any tile without a dedicated screen but with an ERP endpoint. */
export function GenericDataScreen({ tile }: { tile: MenuTile }) {
  const q = useQuery({
    queryKey: ['tile-data', tile.key],
    queryFn: () => callAuto(tile.api!, parseApiParam(tile.apiParam)),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={userMessage(q.error)} onRetry={() => void q.refetch()} />;
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <DataView data={q.data?.data} />
    </Page>
  );
}
