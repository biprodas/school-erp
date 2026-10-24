import { inAudience, type Viewer } from './audience';

const staff: Viewer = {
  userId: 'u-t',
  roleIds: ['r-teacher'],
  portalOnly: false,
  isGuardian: false,
  isStudent: false,
  sectionIds: ['s-6a'],
  classIds: ['c-6'],
  groupIds: [],
};
const guardian: Viewer = {
  userId: 'u-g',
  roleIds: ['r-guardian'],
  portalOnly: true,
  isGuardian: true,
  isStudent: false,
  sectionIds: ['s-7b'],
  classIds: ['c-7'],
  groupIds: ['g-science'],
};

describe('inAudience', () => {
  it.each([
    [{ type: 'all', ids: [] }, true, true],
    [{ type: 'staff', ids: [] }, true, false],
    [{ type: 'guardians', ids: [] }, false, true],
    [{ type: 'students', ids: [] }, false, false],
    [{ type: 'role', ids: ['r-teacher'] }, true, false],
    [{ type: 'class', ids: ['c-7'] }, false, true],
    [{ type: 'section', ids: ['s-6a', 's-9a'] }, true, false],
    [{ type: 'group', ids: ['g-science'] }, false, true],
    [{ type: 'users', ids: ['u-g'] }, false, true],
  ] as const)('%j reaches staff=%s guardian=%s', (audience, s, g) => {
    expect(inAudience({ ...audience, ids: [...audience.ids] }, staff)).toBe(s);
    expect(inAudience({ ...audience, ids: [...audience.ids] }, guardian)).toBe(
      g,
    );
  });
});
