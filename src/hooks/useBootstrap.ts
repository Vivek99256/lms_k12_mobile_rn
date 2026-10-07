import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuthStore } from '../auth/authStore';
import { buildMenu } from '../menu/buildMenu';
import { fetchBootstrap } from '../menu/menuApi';
import { MenuModel } from '../menu/types';
import { buildPermissions, EMPTY_PERMISSIONS, PermissionSnapshot } from '../rbac/permissions';

const EMPTY_MENU: MenuModel = { sections: [], tiles: new Map() };

/**
 * Server state for "who am I and what may I open". Refetched on app foreground and after
 * a 401/403 (see App.tsx), so permission changes in the ERP take effect without re-login.
 */
export function useBootstrap() {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ['bootstrap', user?.id, user?.userProfileId],
    queryFn: () => fetchBootstrap(user!),
    enabled: !!user,
    staleTime: 60_000,
  });

  const menu = useMemo(() => (query.data ? buildMenu(query.data.menu) : EMPTY_MENU), [query.data]);
  const permissions: PermissionSnapshot = useMemo(
    () =>
      query.data
        ? buildPermissions(user?.userProfileId ?? null, query.data.user.user_profile_name, menu)
        : EMPTY_PERMISSIONS,
    [query.data, menu, user?.userProfileId],
  );

  return { ...query, menu, permissions };
}
