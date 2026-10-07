import { SCHOOL_INFO_ACTIONS, schoolInfoAction, schoolInfoParts } from '../src/screens/student/schoolInfoModel';

describe('school information actions', () => {
  it('each of the nine pages sends its exact fixed action text', () => {
    expect(SCHOOL_INFO_ACTIONS).toEqual({
      about_us: 'About Us',
      principal_desk: 'Principal Desk',
      school_information: 'School Information',
      achievement: 'Achievement',
      school_timing: 'School Timing',
      rules: 'Rules',
      facility: 'Facility',
      acadamic_activity: 'Academic Activity',
      reach_us: 'Reach Us',
    });
    for (const [name, action] of Object.entries(SCHOOL_INFO_ACTIONS)) expect(schoolInfoAction(name)).toBe(action);
  });

  it('an unknown, empty or inherited screen name has no action (so no request is made)', () => {
    for (const n of [null, undefined, '', 'photos_gallery', 'achievement_certificate', 'ABOUT_US', 'constructor', 'toString', '__proto__']) {
      expect(schoolInfoAction(n)).toBeNull();
    }
  });
});

describe('schoolInfoParts', () => {
  const row = (content: string, type = 'About Us') => ({ type, content });

  it('turns the HTML content into plain text and ignores the page type (the swapped title field)', () => {
    const parts = schoolInfoParts([row('<h2>Welcome</h2><p>Our <b>school</b> was founded in 1990.</p><ul><li>Sports</li><li>Music</li></ul>', 'About Us')]);
    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe('Welcome\nOur school was founded in 1990.\n• Sports\n• Music');
    expect(parts[0].text).not.toContain('About Us');
  });

  it('removes scripts and styles with their content; encoded tags stay visible text', () => {
    expect(schoolInfoParts([row('<style>p{color:red}</style><script>alert(1)</script><p>Hi</p>')])[0].text).toBe('Hi');
    expect(schoolInfoParts([row('&lt;b&gt;x&lt;/b&gt; &amp; y')])[0].text).toBe('<b>x</b> & y');
  });

  it('keeps URLs as text (links are made tappable by the screen, never here); img / iframe add nothing', () => {
    const [p] = schoolInfoParts([row('<p>Visit https://school.example/page now</p><img src="https://x/y.png"><iframe src="https://evil.example"></iframe>')]);
    expect(p.text).toBe('Visit https://school.example/page now');
  });

  it('rows with no text are left out - nothing is invented; the rest keep the server order and unique keys', () => {
    const parts = schoolInfoParts([row('<p></p>'), row('First'), row('   '), row('<div><br></div>'), row('Second')]);
    expect(parts.map((p) => p.text)).toEqual(['First', 'Second']);
    expect(new Set(parts.map((p) => p.key)).size).toBe(2);
  });

  it('no rows -> no parts', () => expect(schoolInfoParts([])).toEqual([]));

  it('long adversarial input stays fast', () => {
    const t0 = Date.now();
    schoolInfoParts([row('<p>'.repeat(200000)), row('<'.repeat(100000))]);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
