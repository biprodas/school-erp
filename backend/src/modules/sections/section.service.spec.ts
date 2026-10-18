import { ConflictException, NotFoundException } from '@nestjs/common';
import { SectionRepository } from './section.repository';
import { SectionService } from './section.service';
import { Section } from './entities/section.entity';

const makeSection = (overrides: Partial<Section> = {}): Section => ({
  id: 'sec-1',
  orgId: 'org-1',
  name: 'A',
  code: null,
  description: null,
  isActive: true,
  classLinks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SectionService', () => {
  let service: SectionService;
  let repo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByName: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data: Partial<Section>) =>
        Promise.resolve(makeSection({ id: 'new-sec', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    service = new SectionService(repo as unknown as SectionRepository);
  });

  it('creates a section with defaults', async () => {
    repo.findByName.mockResolvedValue(null);

    const result = await service.create({ name: 'A' });

    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'A', isActive: true }),
    );
    expect(result.id).toBe('new-sec');
  });

  it('rejects a duplicate name', async () => {
    repo.findByName.mockResolvedValue(makeSection());

    await expect(service.create({ name: 'A' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('propagates not-found on remove', async () => {
    repo.findByIdOrFail.mockRejectedValue(new NotFoundException());

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
