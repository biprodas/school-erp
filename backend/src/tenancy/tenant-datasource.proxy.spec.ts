import type { EntityManager, QueryRunner } from 'typeorm';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';

function makeQueryRunner() {
  const runner = {
    isReleased: false,
    isTransactionActive: false,
    startTransaction: jest.fn(() => {
      runner.isTransactionActive = true;
      return Promise.resolve();
    }),
    commitTransaction: jest.fn(() => {
      runner.isTransactionActive = false;
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(() => {
      runner.isTransactionActive = false;
      return Promise.resolve();
    }),
    query: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(() => {
      runner.isReleased = true;
      return Promise.resolve();
    }),
    releasePostgresConnection: jest.fn(() => {
      runner.isReleased = true;
      return Promise.resolve();
    }),
  };
  return runner;
}

const proxyFor = (runner: ReturnType<typeof makeQueryRunner>) =>
  new TenantDataSourceProxy(
    {} as EntityManager,
    runner as unknown as QueryRunner,
    'org-a',
  );

describe('TenantDataSourceProxy', () => {
  describe('runInTransaction', () => {
    it('commits and returns the result when the work succeeds', async () => {
      const runner = makeQueryRunner();
      const result = await proxyFor(runner).runInTransaction(() =>
        Promise.resolve('done'),
      );

      expect(result).toBe('done');
      expect(runner.startTransaction).toHaveBeenCalledTimes(1);
      expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('rolls back and rethrows when the work throws', async () => {
      const runner = makeQueryRunner();
      await expect(
        proxyFor(runner).runInTransaction(() =>
          Promise.reject(new Error('boom')),
        ),
      ).rejects.toThrow('boom');

      expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('resets the org setting and returns the connection to the pool', async () => {
      const runner = makeQueryRunner();
      await proxyFor(runner).release();

      expect(runner.query).toHaveBeenCalledWith('RESET app.org_id');
      expect(runner.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back a transaction left open before resetting', async () => {
      const runner = makeQueryRunner();
      runner.isTransactionActive = true;
      await proxyFor(runner).release();

      expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(runner.release).toHaveBeenCalledTimes(1);
    });

    it('destroys the connection instead of pooling it when the reset fails', async () => {
      const runner = makeQueryRunner();
      const err = new Error('connection lost');
      runner.query.mockRejectedValueOnce(err);

      await expect(proxyFor(runner).release()).rejects.toThrow(err);
      expect(runner.releasePostgresConnection).toHaveBeenCalledWith(err);
      expect(runner.release).not.toHaveBeenCalled();
    });

    it('does nothing when already released', async () => {
      const runner = makeQueryRunner();
      runner.isReleased = true;
      await proxyFor(runner).release();

      expect(runner.query).not.toHaveBeenCalled();
      expect(runner.release).not.toHaveBeenCalled();
    });
  });
});
