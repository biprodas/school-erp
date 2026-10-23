import { ClassSubjectType } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import { NCTB_TEMPLATE } from '~/shared/templates/curriculum/nctb';
import { classSubjects } from './curriculum-template.service';

const byName = (className: string) => {
  const c = NCTB_TEMPLATE.classes.find((x) => x.name === className)!;
  return new Map(classSubjects(NCTB_TEMPLATE, c).map((s) => [s.name, s]));
};

describe('classSubjects (template)', () => {
  const nine = byName('Class 9');

  it('types the class lists: compulsory, optional (religion), 4th', () => {
    expect(nine.get('Mathematics')?.type).toBe(ClassSubjectType.COMPULSORY);
    expect(nine.get('Islam and Moral Education')?.type).toBe(
      ClassSubjectType.OPTIONAL,
    );
    expect(nine.get('Higher Mathematics')?.type).toBe(ClassSubjectType.FOURTH);
  });

  it('adds group subjects, tagged when only one group lists them', () => {
    expect(nine.get('Physics')).toEqual({
      name: 'Physics',
      type: ClassSubjectType.COMPULSORY,
      group: 'Science',
    });
    // In Business Studies and Humanities: shared, so no group.
    expect(nine.get('General Science')).toMatchObject({
      type: ClassSubjectType.COMPULSORY,
      group: null,
    });
    expect(nine.get('Economics')).toMatchObject({
      type: ClassSubjectType.OPTIONAL,
      group: 'Humanities',
    });
    // Listed by the class as a 4th subject first: that wins.
    expect(nine.get('Biology')?.type).toBe(ClassSubjectType.FOURTH);
  });

  it('leaves classes without groups to their own lists', () => {
    const one = byName('Class 1');
    expect([...one.keys()]).toEqual(['Bangla', 'English', 'Mathematics']);
  });

  it('gives every board subject of Class 9–10 components that add up', () => {
    for (const s of NCTB_TEMPLATE.subjects) {
      for (const c of s.components ?? []) {
        expect(c.passMarks).toBeLessThanOrEqual(c.fullMarks);
      }
      const total = (s.components ?? []).reduce((n, c) => n + c.fullMarks, 0);
      if (s.components) expect([50, 100]).toContain(total);
    }
  });
});
