import React from 'react';
import { EmptyState } from '../../components/ui';
import { MenuTile } from '../../menu/types';

/**
 * Hostel (`studentHostelAllocationAPI`) and Achievement Certificate (`document_details`) cannot work for a token-only
 * caller (the backend reads the school from a web session). The screen makes no request at all.
 */
export function RecordUnavailableScreen(_props: { tile: MenuTile }) {
  return <EmptyState title="This isn't available in the app yet." hint="Please ask your school." />;
}
