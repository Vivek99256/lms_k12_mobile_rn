import { buildMenu } from '../src/menu/buildMenu';
import {
  buildPermissions,
  canAccessScreen,
  EMPTY_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  hasRole,
} from '../src/rbac/permissions';

const menu = buildMenu([
  {
    main_title: 'Academics',
    contents: [
      { title: 'Attendance', screen_name: 'attendance', api: 'x' },
      { title: 'Attendance', screen_name: 'attendance2' }, // duplicate title
    ],
  },
  { main_title: 'Empty', contents: [] },
]);

describe('buildMenu', () => {
  it('creates stable unique keys and drops empty sections', () => {
    expect(menu.sections).toHaveLength(1);
    expect([...menu.tiles.keys()]).toEqual(['academics/attendance', 'academics/attendance-2']);
  });

  it('merges repeated sections and drops duplicate tiles (legacy endpoint quirk)', () => {
    const tile = { title: 'My Attendance', screen_name: 'att', api: 'a' };
    const m = buildMenu([
      { main_title: 'My Attendance', contents: [tile] },
      { main_title: 'Fees', contents: [{ title: 'Pay' }] },
      { main_title: 'My Attendance', contents: [tile, { title: 'Leave' }] },
    ]);
    expect(m.sections.map((s) => s.title)).toEqual(['My Attendance', 'Fees']);
    expect(m.sections[0].tiles.map((t) => t.title)).toEqual(['My Attendance', 'Leave']);
    expect(m.tiles.size).toBe(3);
  });

  it('defaults unknown render types to native', () => {
    const m = buildMenu([{ main_title: 'A', contents: [{ title: 'T', render_type: 'weird' }] }]);
    expect(m.tiles.get('a/t')?.renderType).toBe('native');
  });
});

describe('permissions', () => {
  const p = buildPermissions(5, 'Teacher', menu, { fees: { view: true } });

  it('allows only screens the backend listed', () => {
    expect(canAccessScreen(p, 'academics/attendance')).toBe(true);
    expect(canAccessScreen(p, 'admin/users')).toBe(false);
  });

  it('denies everything before the menu has loaded', () => {
    expect(canAccessScreen(EMPTY_PERMISSIONS, 'academics/attendance')).toBe(false);
    expect(hasRole(EMPTY_PERMISSIONS, '')).toBe(false);
  });

  it('checks module actions and fails closed', () => {
    expect(hasPermission(p, 'fees', 'view')).toBe(true);
    expect(hasPermission(p, 'fees', 'delete')).toBe(false);
    expect(hasPermission(p, 'unknown')).toBe(false);
    expect(hasAnyPermission(p, [{ module: 'unknown' }, { module: 'fees' }])).toBe(true);
  });

  it('matches roles case-insensitively', () => {
    expect(hasRole(p, 'teacher')).toBe(true);
    expect(hasRole(p, 'Admin', 'Student')).toBe(false);
  });
});
