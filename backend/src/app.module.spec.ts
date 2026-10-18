import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TENANT_POOL_DATASOURCE } from '~/tenancy/tenancy.constants';

// Minimal valid config; no database is contacted (the DataSources are stubbed).
Object.assign(process.env, {
  DB_HOST: 'localhost',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
  DB_APP_USERNAME: '',
  JWT_SECRET: 'unit-test-secret-at-least-32-characters',
  LOG_LEVEL: 'silent',
});

/**
 * Boots the whole AppModule with stubbed database connections so a provider
 * that a module uses but doesn't import (or an import that isn't exported)
 * fails here instead of at server start-up. This covers request-scoped
 * providers too.
 */
describe('AppModule wiring', () => {
  it('resolves every provider and controller', async () => {
    // Required after the env is set: ConfigModule validates it on import.
    type AppModuleFile = typeof import('./app.module');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const file = require('./app.module') as AppModuleFile;
    const stubDataSource = {
      getRepository: () => ({}),
      entityMetadatas: [],
      options: {},
      isInitialized: true,
      destroy: () => Promise.resolve(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [file.AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(stubDataSource)
      .overrideProvider(TENANT_POOL_DATASOURCE)
      .useValue(stubDataSource)
      .compile();
    const app = moduleRef.createNestApplication({ logger: false });

    await expect(app.init()).resolves.toBe(app);
    await app.close();
  }, 30000);
});
