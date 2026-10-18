import { Inject, NotFoundException } from '@nestjs/common';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '~/common/dto/pagination-query.dto';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { TENANT_DATASOURCE } from './tenancy.constants';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';
import { ORG_ID_PROPERTY, scopeRepository } from './org-scoped-repository';

/**
 * Abstract base class for tenant-scoped repositories.
 *
 * Owns the TypeORM `Repository<T>` and provides standard data access
 * methods. Concrete repositories extend this class and can add
 * entity-specific queries using `this.repo`.
 *
 * For org-scoped entities (those extending `OrgScopedEntity`), `this.repo`
 * is wrapped by `scopeRepository`, so find/count/save/update/delete calls
 * are automatically pinned to the request's organization. Query builders
 * are not rewritten: add `.andWhere('alias.orgId = :orgId', { orgId:
 * this.orgId })` yourself (row-level security still backs it up).
 *
 * Usage:
 * ```ts
 * @Injectable()
 * export class DepartmentRepository extends BaseTenantRepository<Department> {
 *   constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
 *     super(ds, Department, 'Department');
 *   }
 * }
 * ```
 */
export abstract class BaseTenantRepository<T extends ObjectLiteral> {
  protected readonly repo: Repository<T>;
  /** The organization every query of this repository is scoped to. */
  protected readonly orgId: string;

  constructor(
    @Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy,
    entityClass: new () => T,
    public readonly entityName: string = 'Entity',
  ) {
    this.orgId = ds.orgId;
    const repo = ds.getRepository(entityClass);
    const isOrgScoped =
      !!repo.metadata.findColumnWithPropertyName(ORG_ID_PROPERTY);
    this.repo = isOrgScoped ? scopeRepository(repo, ds.orgId) : repo;
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(options);
  }

  async findById(id: string): Promise<T | null> {
    return this.repo.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findByIdOrFail(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundException(
        `${this.entityName} with id "${id}" not found`,
      );
    }
    return entity;
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne(options);
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(options);
  }

  async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repo.findAndCount(options);
  }

  /** One page of `find(options)` plus the total count for `meta`. */
  async findPage(
    options: FindManyOptions<T>,
    { page = 1, limit = DEFAULT_PAGE_SIZE }: PaginationQueryDto = {},
  ): Promise<Paginated<T>> {
    const [items, total] = await this.repo.findAndCount({
      ...options,
      skip: (page - 1) * limit,
      take: limit,
    });
    return new Paginated(items, total, { page, limit });
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.repo.count(options);
  }

  createEntity(data: DeepPartial<T>): T {
    return this.repo.create(data);
  }

  async save(entity: T): Promise<T> {
    return this.repo.save(entity);
  }

  async saveNew(data: DeepPartial<T>): Promise<T> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  /**
   * Entities with a `@DeleteDateColumn` are soft-deleted (the row keeps its
   * history and children; default finds stop returning it). Others are
   * deleted for good.
   */
  get isSoftDeletable(): boolean {
    return !!this.repo.metadata.deleteDateColumn;
  }

  async remove(entity: T): Promise<T> {
    return this.isSoftDeletable
      ? this.repo.softRemove(entity)
      : this.repo.remove(entity);
  }

  async deleteById(id: string): Promise<void> {
    if (this.isSoftDeletable) {
      await this.repo.softDelete(id);
    } else {
      await this.repo.delete(id);
    }
  }
}
