import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  QueryRunner,
  Repository,
} from 'typeorm';
import { ORG_SETTING } from './rls';

/**
 * A lightweight proxy that looks like a DataSource to consuming services
 * but delegates to a scoped EntityManager whose QueryRunner has already
 * executed `set_config('app.org_id', <orgId>)`, which the row-level
 * security policies on every org-scoped table read.
 *
 * Services continue to call `ds.getRepository(Entity)` unchanged.
 */
export class TenantDataSourceProxy {
  constructor(
    private readonly manager: EntityManager,
    private readonly queryRunner: QueryRunner,
    /** The organization this connection is scoped to. */
    public readonly orgId: string,
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

  /**
   * Clear the org setting and release the connection back to the pool, so
   * the next borrower never inherits this org's RLS context.
   */
  async release(): Promise<void> {
    if (this.queryRunner.isReleased) return;
    try {
      await this.queryRunner.query(`RESET ${ORG_SETTING}`);
    } finally {
      await this.queryRunner.release();
    }
  }

  get isReleased(): boolean {
    return this.queryRunner.isReleased;
  }
}
