import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  QueryRunner,
  Repository,
} from 'typeorm';

/**
 * A lightweight proxy that looks like a DataSource to consuming services
 * but delegates to a scoped EntityManager whose QueryRunner has already
 * executed `SET search_path TO "<tenant_schema>", public`.
 *
 * Services continue to call `ds.getRepository(Entity)` unchanged.
 */
export class TenantDataSourceProxy {
  constructor(
    private readonly manager: EntityManager,
    private readonly queryRunner: QueryRunner,
  ) {}

  getRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
  ): Repository<T> {
    return this.manager.getRepository(entity);
  }

  /** Expose the scoped manager for services that need transactions. */
  getManager(): EntityManager {
    return this.manager;
  }

  /** Release the underlying connection back to the pool. */
  async release(): Promise<void> {
    if (!this.queryRunner.isReleased) {
      await this.queryRunner.release();
    }
  }

  get isReleased(): boolean {
    return this.queryRunner.isReleased;
  }
}
