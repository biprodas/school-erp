import { DataSource } from 'typeorm';
import { loadE2eEnv } from './e2e-env';

/**
 * Creates the e2e database if it does not exist yet. Tables, RLS policies and
 * the restricted app role are then set up by the app itself on boot
 * (`DB_SYNC=true` + TenancyModule's dev bootstrap).
 */
export default async function globalSetup(): Promise<void> {
  loadE2eEnv();
  const database = process.env.DB_NAME!;

  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (!rows.length) {
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.destroy();
  }
}
