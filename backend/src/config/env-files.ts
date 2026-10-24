/**
 * Env files the app (`ConfigModule`) and the TypeORM CLI load, relative to
 * the working directory. A variable set in an earlier file wins over a later
 * one; variables already set in the shell win over all of them.
 *
 * `.env.local` holds this machine's settings and comes first. Like Next.js,
 * it is skipped under `NODE_ENV=test` so tests don't depend on one machine.
 */
export function envFilePaths(
  nodeEnv = process.env.NODE_ENV ?? 'development',
): string[] {
  const files = ['.env', `.env.${nodeEnv}`];
  return nodeEnv === 'test' ? files : ['.env.local', ...files];
}
