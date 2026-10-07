import { NotificationItem } from '../src/api/student';
import { groupNotifications, limitGroups, NOTIFICATION_PAGE_SIZE } from '../src/screens/student/notificationModel';

const n = (id: string, date: string, type = 'Homework', description = 'text'): NotificationItem => ({ id, type, description, date });
const TODAY = '2026-10-07';

describe('groupNotifications', () => {
  it('groups by day, newest day first, with Today / Yesterday / long-date headings', () => {
    const g = groupNotifications([n('1', '05-10-2026'), n('2', '07-10-2026'), n('3', '06-10-2026'), n('4', '07-10-2026')], TODAY);
    expect(g.map((x) => x.label)).toEqual(['Today', 'Yesterday', '5 October 2026']);
    expect(g[0].items.map((i) => i.id)).toEqual(['2', '4']); // server order kept inside a day
  });

  it('puts notifications with an unreadable date last under "Earlier"', () => {
    const g = groupNotifications([n('1', ''), n('2', '07-10-2026'), n('3', 'sometime')], TODAY);
    expect(g.map((x) => x.label)).toEqual(['Today', 'Earlier']);
    expect(g[1].items.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('reads ISO dates too and keeps unknown notification types as they are', () => {
    const g = groupNotifications([n('1', '2026-10-07', 'Brand New Type')], TODAY);
    expect(g[0].items[0].type).toBe('Brand New Type');
    expect(g[0].label).toBe('Today');
  });

  it('is empty for no notifications', () => {
    expect(groupNotifications([], TODAY)).toEqual([]);
  });
});

describe('limitGroups (client-side "Show more", S1-D5)', () => {
  const many = Array.from({ length: 70 }, (_, i) => n(String(i), i < 40 ? '07-10-2026' : '06-10-2026'));
  const groups = groupNotifications(many, TODAY);
  const count = (gs: typeof groups) => gs.reduce((a, g) => a + g.items.length, 0);

  it('page size is 30', () => {
    expect(NOTIFICATION_PAGE_SIZE).toBe(30);
  });

  it('clips inside a day and drops later days', () => {
    const first = limitGroups(groups, 30);
    expect(count(first)).toBe(30);
    expect(first).toHaveLength(1);
    expect(first[0].items[0].id).toBe('0');
  });

  it('shows more days as the limit grows and never more than exist', () => {
    expect(limitGroups(groups, 60).map((g) => g.items.length)).toEqual([40, 20]);
    expect(count(limitGroups(groups, 500))).toBe(70);
  });

  it('a zero limit shows nothing', () => {
    expect(limitGroups(groups, 0)).toEqual([]);
  });
});
