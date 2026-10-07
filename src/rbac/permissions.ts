import { MenuModel } from '../menu/types';

export type Action = 'view' | 'create' | 'update' | 'delete';

/**
 * Everything the app knows about what the caller may do. It is derived from the backend
 * (menu from /api/mobile/bootstrap, role from the token) and never hardcoded here.
 */
export interface PermissionSnapshot {
  roleId: number | null;
  roleName: string;
  /** Tile keys the backend returned in the user's menu. */
  screens: ReadonlySet<string>;
  /** Optional per-module CRUD flags (from /api/permissions), keyed by module name. */
  modules: Readonly<Record<string, Partial<Record<Action, boolean>>>>;
}

export const EMPTY_PERMISSIONS: PermissionSnapshot = {
  roleId: null,
  roleName: '',
  screens: new Set(),
  modules: {},
};

export function buildPermissions(
  roleId: number | null,
  roleName: string,
  menu: MenuModel,
  modules: PermissionSnapshot['modules'] = {},
): PermissionSnapshot {
  return { roleId, roleName, screens: new Set(menu.tiles.keys()), modules };
}

/** Fails closed: an unknown module or action is denied. */
export function hasPermission(p: PermissionSnapshot, module: string, action: Action = 'view'): boolean {
  return p.modules[module]?.[action] === true;
}

export function hasAnyPermission(p: PermissionSnapshot, checks: { module: string; action?: Action }[]): boolean {
  return checks.some((c) => hasPermission(p, c.module, c.action));
}

export function hasRole(p: PermissionSnapshot, ...roles: string[]): boolean {
  const mine = p.roleName.trim().toLowerCase();
  return mine !== '' && roles.some((r) => r.trim().toLowerCase() === mine);
}

/** The one gate for navigation: a screen is reachable only if the backend listed it. */
export function canAccessScreen(p: PermissionSnapshot, key: string): boolean {
  return p.screens.has(key);
}
