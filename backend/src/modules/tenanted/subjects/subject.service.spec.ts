import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubjectRepository } from './subject.repository';
import { SubjectService } from './subject.service';
import { Subject } from './entities/subject.entity';
import { SubjectType } from './enums/subject-type.enum';

const makeSubject = (overrides: Partial<Subject> = {}): Subject => ({
  id: 'sub-1',
  orgId: 'org-1',
  name: 'Mathematics',
  code: null,
  type: SubjectType.THEORY,
  isOptional: false,
  credit: null,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SubjectService', () => {
  let service: SubjectService;
  let repo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByName: jest.fn(),
      findByCode: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeSubject({ id: 'new-sub', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    service = new SubjectService(repo as unknown as SubjectRepository);
  });

  it('creates a subject defaulting to theory', async () => {
    repo.findByName.mockResolvedValue(null);

    const result = await service.create({ name: 'Mathematics' });

    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mathematics',
        type: SubjectType.THEORY,
      }),
    );
    expect(result.id).toBe('new-sub');
  });

  it('rejects a duplicate name', async () => {
    repo.findByName.mockResolvedValue(makeSubject());

    await expect(service.create({ name: 'Mathematics' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a duplicate code', async () => {
    repo.findByName.mockResolvedValue(null);
    repo.findByCode.mockResolvedValue(makeSubject({ code: 'MATH' }));

    await expect(
      service.create({ name: 'Algebra', code: 'MATH' }),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates not-found on remove', async () => {
    repo.findByIdOrFail.mockRejectedValue(new NotFoundException());

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
