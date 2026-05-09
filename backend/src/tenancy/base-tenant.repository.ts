import { Inject, NotFoundException } from '@nestjs/common';
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

/**
 * Abstract base class for tenant-scoped repositories.
 *
 * Owns the TypeORM `Repository<T>` and provides standard data access
 * methods. Concrete repositories extend this class and can add
 * entity-specific queries using `this.repo`.
 *
 * Usage:
 * ```ts
 * @Injectable()
 * export class CatRepository extends BaseTenantRepository<Cat> {
 *   constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
 *     super(ds, Cat, 'Cat');
 *   }
 * }
 * ```
 */
export abstract class BaseTenantRepository<T extends ObjectLiteral> {
  protected readonly repo: Repository<T>;

  constructor(
    @Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy,
    entityClass: new () => T,
    public readonly entityName: string = 'Entity',
  ) {
    this.repo = ds.getRepository(entityClass);
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

  async remove(entity: T): Promise<T> {
    return this.repo.remove(entity);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
