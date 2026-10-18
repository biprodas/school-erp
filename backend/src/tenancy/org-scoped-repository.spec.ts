import { ForbiddenException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { scopeRepository, scopeWhere } from './org-scoped-repository';
import { BaseTenantRepository } from './base-tenant.repository';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';

type Row = { id: string; orgId: string; name?: string };

const ORG = 'org-a';

type RepoMock = Record<string, jest.Mock> & {
  metadata: {
    findColumnWithPropertyName: jest.Mock;
    deleteDateColumn: unknown;
  };
};

const makeRepo = (): RepoMock =>
  ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    sum: jest.fn().mockResolvedValue(0),
    increment: jest.fn(),
    remove: jest.fn((data: unknown) => Promise.resolve(data)),
    upsert: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue('qb'),
    metadata: {
      findColumnWithPropertyName: jest.fn(),
      deleteDateColumn: undefined as unknown,
    },
  }) as unknown as RepoMock;

const asRepo = (raw: RepoMock) => raw as unknown as Repository<Row>;

describe('scopeWhere', () => {
  it('adds orgId to an object where', () => {
    expect(scopeWhere({ name: 'x' }, ORG)).toEqual({ name: 'x', orgId: ORG });
  });

  it('adds orgId when where is missing', () => {
    expect(scopeWhere(undefined, ORG)).toEqual({ orgId: ORG });
  });

  it('adds orgId to every OR branch', () => {
    expect(scopeWhere([{ name: 'a' }, { name: 'b' }], ORG)).toEqual([
      { name: 'a', orgId: ORG },
      { name: 'b', orgId: ORG },
    ]);
  });

  it('overrides a caller-supplied orgId', () => {
    expect(scopeWhere({ orgId: 'org-b' }, ORG)).toEqual({ orgId: ORG });
  });
});

describe('scopeRepository', () => {
  let raw: RepoMock;
  let repo: Repository<Row>;

  beforeEach(() => {
    raw = makeRepo();
    repo = scopeRepository(asRepo(raw), ORG);
  });

  it('scopes find / findOne / findAndCount / count', async () => {
    await repo.find({ where: { name: 'x' }, order: { name: 'ASC' } });
    expect(raw.find).toHaveBeenCalledWith({
      where: { name: 'x', orgId: ORG },
      order: { name: 'ASC' },
    });

    await repo.find();
    expect(raw.find).toHaveBeenLastCalledWith({ where: { orgId: ORG } });

    await repo.findOne({ where: { id: '1' } });
    expect(raw.findOne).toHaveBeenCalledWith({
      where: { id: '1', orgId: ORG },
    });

    await repo.findAndCount({ where: [{ name: 'a' }, { name: 'b' }] });
    expect(raw.findAndCount).toHaveBeenCalledWith({
      where: [
        { name: 'a', orgId: ORG },
        { name: 'b', orgId: ORG },
      ],
    });

    await repo.count();
    expect(raw.count).toHaveBeenCalledWith({ where: { orgId: ORG } });
  });

  it('scopes *By variants', async () => {
    await repo.findOneBy({ id: '1' });
    expect(raw.findOneBy).toHaveBeenCalledWith({ id: '1', orgId: ORG });
  });

  it('stamps orgId on create and save', async () => {
    expect(repo.create({ name: 'x' })).toEqual({ name: 'x', orgId: ORG });
    await repo.save([{ id: '1' } as Row, { id: '2' } as Row]);
    expect(raw.save).toHaveBeenCalledWith([
      { id: '1', orgId: ORG },
      { id: '2', orgId: ORG },
    ]);
  });

  it('blocks writes that target another organization', () => {
    expect(() => repo.create({ name: 'x', orgId: 'org-b' })).toThrow(
      ForbiddenException,
    );
    expect(() => repo.save({ id: '1', orgId: 'org-b' })).toThrow(
      ForbiddenException,
    );
    expect(() => repo.update({ id: '1' }, { orgId: 'org-b' })).toThrow(
      ForbiddenException,
    );
    expect(raw.save).not.toHaveBeenCalled();
    expect(raw.update).not.toHaveBeenCalled();
  });

  it('pins update / delete criteria to the organization', async () => {
    await repo.update({ name: 'x' }, { name: 'y' });
    expect(raw.update).toHaveBeenCalledWith(
      { name: 'x', orgId: ORG },
      { name: 'y' },
    );

    await repo.delete('id-1');
    expect(raw.delete).toHaveBeenLastCalledWith({ id: 'id-1', orgId: ORG });

    await repo.delete(['id-1', 'id-2']);
    expect(raw.delete).toHaveBeenLastCalledWith({
      id: In(['id-1', 'id-2']),
      orgId: ORG,
    });

    await repo.delete({ name: 'x' });
    expect(raw.delete).toHaveBeenLastCalledWith({ name: 'x', orgId: ORG });
  });

  it('scopes aggregates and increment / decrement', async () => {
    await repo.sum('id' as never, { name: 'x' });
    expect(raw.sum).toHaveBeenCalledWith('id', { name: 'x', orgId: ORG });

    await repo.increment({ id: '1' }, 'name', 1);
    expect(raw.increment).toHaveBeenCalledWith(
      { id: '1', orgId: ORG },
      'name',
      1,
    );
  });

  it('only removes entities that belong to the organization', async () => {
    await repo.remove({ id: '1', orgId: ORG });
    expect(raw.remove).toHaveBeenCalledWith({ id: '1', orgId: ORG });

    expect(() => repo.remove({ id: '2', orgId: 'org-b' })).toThrow(
      ForbiddenException,
    );
    expect(() => repo.remove([{ id: '3' } as Row])).toThrow(ForbiddenException);
    expect(raw.remove).toHaveBeenCalledTimes(1);
  });

  it('blocks unscoped escape hatches', () => {
    expect(() => repo.upsert({ id: '1' }, ['id'])).toThrow(/upsert/);
    expect(() => repo.query('SELECT 1')).toThrow(/query/);
    expect(() => repo.manager).toThrow(/manager/);
    expect(raw.upsert).not.toHaveBeenCalled();
    expect(raw.query).not.toHaveBeenCalled();
  });

  it('passes other members through untouched', () => {
    expect(repo.createQueryBuilder('r')).toBe('qb');
    expect(repo.metadata).toBe(raw.metadata);
  });

  it('runs getters against the raw repository, as TypeORM getters need its manager', () => {
    // Like TypeORM's Repository: `metadata` is a getter reading `this.manager`.
    class GetterRepo {
      manager = { metadata: { deleteDateColumn: 'deletedAt' } };
      get metadata() {
        return this.manager.metadata;
      }
    }
    const repo = scopeRepository(
      new GetterRepo() as unknown as Repository<Row>,
      ORG,
    );

    expect(repo.metadata).toEqual({ deleteDateColumn: 'deletedAt' });
    expect(() => repo.manager).toThrow(/not available/);
  });
});

describe('BaseTenantRepository', () => {
  class Entity {
    id: string;
    orgId: string;
  }
  class EntityRepository extends BaseTenantRepository<Entity> {
    get raw() {
      return this.repo;
    }
  }

  const proxyFor = (raw: RepoMock) =>
    ({
      orgId: ORG,
      getRepository: () => raw,
    }) as unknown as TenantDataSourceProxy;

  it('scopes repositories of org-scoped entities', async () => {
    const raw = makeRepo();
    raw.metadata.findColumnWithPropertyName.mockReturnValue({});
    const repo = new EntityRepository(proxyFor(raw), Entity, 'Entity');

    await repo.findById('1');
    expect(raw.findOne).toHaveBeenCalledWith({
      where: { id: '1', orgId: ORG },
    });

    await repo.saveNew({ id: '2' });
    expect(raw.save).toHaveBeenCalledWith({ id: '2', orgId: ORG });

    await repo.deleteById('3');
    expect(raw.delete).toHaveBeenCalledWith({ id: '3', orgId: ORG });
  });

  it('soft-deletes entities that have a delete-date column', async () => {
    const raw = makeRepo();
    raw.metadata.findColumnWithPropertyName.mockReturnValue({});
    raw.metadata.deleteDateColumn = { propertyName: 'deletedAt' };
    const repo = new EntityRepository(proxyFor(raw), Entity, 'Entity');

    await repo.deleteById('3');

    expect(raw.softDelete).toHaveBeenCalledWith({ id: '3', orgId: ORG });
    expect(raw.delete).not.toHaveBeenCalled();
  });

  it('pages org-scoped results with findPage', async () => {
    const raw = makeRepo();
    raw.metadata.findColumnWithPropertyName.mockReturnValue({});
    raw.findAndCount.mockResolvedValue([[{ id: '1' }], 41]);
    const repo = new EntityRepository(proxyFor(raw), Entity, 'Entity');

    const page = await repo.findPage(
      { where: { id: '1' } },
      { page: 3, limit: 20 },
    );

    expect(raw.findAndCount).toHaveBeenCalledWith({
      where: { id: '1', orgId: ORG },
      skip: 40,
      take: 20,
    });
    expect(page.items).toEqual([{ id: '1' }]);
    expect(page.meta).toEqual({ page: 3, limit: 20, total: 41, totalPages: 3 });
  });

  it('leaves global entities (no orgId column) unscoped', async () => {
    const raw = makeRepo();
    raw.metadata.findColumnWithPropertyName.mockReturnValue(undefined);
    const repo = new EntityRepository(proxyFor(raw), Entity, 'Entity');

    expect(repo.raw).toBe(raw);
    await repo.findById('1');
    expect(raw.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
