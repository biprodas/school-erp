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

  /**
   * Expose the underlying manager. Repositories it returns are NOT
   * org-scoped (only RLS protects them); prefer tenant repositories and
   * {@link runInTransaction}.
   */
  getManager(): EntityManager {
    return this.manager;
  }

  /**
   * Run `work` in a database transaction. Every tenant repository of this
   * request shares this QueryRunner, so all their reads and writes inside
   * `work` join the transaction automatically; it commits when `work`
   * resolves and rolls back when it throws. Nested calls become savepoints.
   *
   * Await everything inside `work`, and don't start two transactions
   * concurrently in one request: they would share the same connection.
   */
  async runInTransaction<R>(work: () => Promise<R>): Promise<R> {
    await this.queryRunner.startTransaction();
    let result: R;
    try {
      result = await work();
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      throw err;
    }
    await this.queryRunner.commitTransaction();
    return result;
  }

  /**
   * Clear the org setting and release the connection back to the pool, so
   * the next borrower never inherits this org's RLS context. A transaction
   * left open is rolled back first. If the reset fails, the connection is
   * destroyed instead of returned to the pool.
   */
  async release(): Promise<void> {
    if (this.queryRunner.isReleased) return;
    try {
      if (this.queryRunner.isTransactionActive) {
        await this.queryRunner.rollbackTransaction();
      }
      await this.queryRunner.query(`RESET ${ORG_SETTING}`);
    } catch (err) {
      await this.destroyConnection(err);
      throw err;
    }
    await this.queryRunner.release();
  }

  /**
   * Release with an error so pg-pool discards the connection rather than
   * reusing it. TypeORM only exposes this on PostgresQueryRunner as a
   * private method, so fall back to a plain release if it ever goes away.
   */
  private async destroyConnection(err: unknown): Promise<void> {
    const runner = this.queryRunner as QueryRunner & {
      releasePostgresConnection?: (err: unknown) => Promise<void>;
    };
    if (typeof runner.releasePostgresConnection === 'function') {
      await runner.releasePostgresConnection(err);
    } else {
      await runner.release();
    }
  }

  get isReleased(): boolean {
    return this.queryRunner.isReleased;
  }
}
