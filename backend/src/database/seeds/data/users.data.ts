import { PlatformRole } from '~/modules/users/enums/platform-role.enum';

export interface SeedUser {
  email: string;
  username: string;
  name: string;
  role: PlatformRole;
  password: string;
}

/** Platform accounts for local/dev environments. Never seeded in production. */
export const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@biprodas.dev',
    username: 'sadmin',
    name: 'Super Admin',
    role: PlatformRole.SUPER_ADMIN,
    password: 'sadmin@123',
  },
  {
    email: 'biprodas@biprodas.dev',
    username: 'biprodas',
    name: 'Biprodas Roy',
    role: PlatformRole.ADMIN,
    password: 'biprodas@123',
  },
  {
    email: 'support@biprodas.dev',
    username: 'support',
    name: 'Support Team',
    role: PlatformRole.SUPPORT,
    password: 'support@123',
  },
  {
    email: 'dev@biprodas.dev',
    username: 'dev',
    name: 'Dev Team',
    role: PlatformRole.DEVELOPER,
    password: 'dev@123',
  },
  {
    email: 'liyana@biprodas.dev',
    username: 'liyana',
    name: 'Liyana',
    role: PlatformRole.USER,
    password: 'liyana@123',
  },
  {
    email: 'demo@pitchpool.io',
    username: 'demo',
    name: 'Demo Player',
    role: PlatformRole.USER,
    password: 'demo@123',
  },
];
