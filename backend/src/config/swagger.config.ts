import { registerAs } from '@nestjs/config';

const swaggerConfig = registerAs('swagger', () => ({
  enabled: (process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() === 'true',
  path: process.env.SWAGGER_PATH ?? 'api/docs',
  title: process.env.SWAGGER_TITLE ?? 'Multi-tenant SaaS API',
  description:
    process.env.SWAGGER_DESCRIPTION ??
    'OpenAPI documentation for the multi-tenant SaaS backend. Platform endpoints manage tenants/users; tenanted endpoints require the x-tenant-id header.',
  version: process.env.VERSION ?? '1.0.0',
}));

export type SwaggerConfig = ReturnType<typeof swaggerConfig>;
export default swaggerConfig;
