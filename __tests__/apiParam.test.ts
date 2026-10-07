import { dashboardEndpoint, parseApiParam } from '../src/utils/helpers';
import { fromLegacy } from '../src/menu/buildMenu';

describe('parseApiParam', () => {
  it('parses JSON, query strings and empties', () => {
    expect(parseApiParam('{"a":1,"b":"x"}')).toEqual({ a: '1', b: 'x' });
    expect(parseApiParam('?a=1&b=2')).toEqual({ a: '1', b: '2' });
    expect(parseApiParam(null)).toEqual({});
  });
});

describe('dashboardEndpoint', () => {
  it('routes by role', () => {
    expect(dashboardEndpoint('Student')).toBe('student-dashboard/summary');
    expect(dashboardEndpoint(' teacher ')).toBe('teacher-dashboard/summary');
    expect(dashboardEndpoint('Super Admin')).toBe('admin-dashboard/summary');
  });
});

describe('fromLegacy', () => {
  it('skips banner sections and maps tiles', () => {
    const out = fromLegacy([
      { main_title: 'Banner', menu_type: 'Banner' },
      { main_title: 'Fees', contents: [{ sub_title: 'Pay', sub_title_api: 'fees/pay', screen_name: 'pay' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].contents[0]).toMatchObject({ title: 'Pay', api: 'fees/pay', screen_name: 'pay' });
  });
});
