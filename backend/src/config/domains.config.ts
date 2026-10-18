import { registerAs } from '@nestjs/config';

const rootDomain = (process.env.ROOT_DOMAIN || 'lvh.me').toLowerCase();

const domainsConfig = registerAs('domains', () => ({
  // Platform root domain; a school can't claim it or any host under it.
  rootDomain,
  // Host every custom domain must CNAME to (doc/domains-and-routing.md, 7).
  cnameTarget: (
    process.env.CUSTOM_DOMAIN_CNAME_TARGET || `schools.${rootDomain}`
  ).toLowerCase(),
  // Most custom domains one school may add.
  maxPerOrg: parseInt(process.env.CUSTOM_DOMAIN_MAX_PER_ORG ?? '5', 10),
}));

export type DomainsConfig = ReturnType<typeof domainsConfig>;
export default domainsConfig;
