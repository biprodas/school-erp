import { DataSource } from 'typeorm';
import publicDataSource from '../public.datasource';
import { seedCore } from './core.seeder';

/**
 * Seed runner: `npm run db:seed:<name>` → `ts-node run-seed.ts <name>`.
 * Connects with the owner role (bypasses RLS). Refuses to run in production.
 */
const SEEDERS: Record<string, (ds: DataSource) => Promise<void>> = {
  core: seedCore,
};

async function main(): Promise<void> {
  const name = process.argv[2];
  const seeder = name ? SEEDERS[name] : undefined;
  if (!seeder) {
    throw new Error(
      `Unknown seeder "${name ?? ''}". Available: ${Object.keys(SEEDERS).join(', ')}`,
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seeders contain dev credentials and must not run in production.',
    );
  }

  await publicDataSource.initialize();
  try {
    console.log(`Seeding "${name}"...`);
    await seeder(publicDataSource);
    console.log(`Seed "${name}" done.`);
  } finally {
    await publicDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
