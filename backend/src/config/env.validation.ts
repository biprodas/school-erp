import Joi from 'joi';

const optionalTcpPort = Joi.any().custom((value, helpers) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    return helpers.error('any.invalid');
  }
  return n;
});

/** `<keyId>:<base64 of 32 bytes>`, e.g. `k1:3q2+7w…=`. */
const FIELD_KEY_SOURCE = '[a-z0-9_-]{1,16}:[A-Za-z0-9+/]{43}=';
const FIELD_KEY_PATTERN = new RegExp(`^${FIELD_KEY_SOURCE}$`);

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test'),
  LOG_LEVEL: Joi.string().valid(
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ),
  HOST: Joi.string(),
  VERSION: Joi.string(),
  NAME: Joi.string(),
  PORT: optionalTcpPort,
  DB_HOST: Joi.string().trim().min(1).required().messages({
    'string.empty': 'DB_HOST is required',
    'any.required': 'DB_HOST is required',
  }),
  DB_PORT: optionalTcpPort,
  DB_USERNAME: Joi.string().required().messages({
    'any.required': 'DB_USERNAME is required',
  }),
  DB_PASSWORD: Joi.string().required().messages({
    'any.required': 'DB_PASSWORD is required',
  }),
  // Restricted role for the tenant pool (row-level security applies to it).
  DB_APP_USERNAME: Joi.string().trim().allow('').optional(),
  DB_APP_PASSWORD: Joi.string()
    .allow('')
    .optional()
    .when('DB_APP_USERNAME', {
      is: Joi.string().trim().min(1),
      then: Joi.string().min(1).required(),
    }),
  DB_NAME: Joi.string().trim().min(1).required().messages({
    'string.empty': 'DB_NAME is required',
    'any.required': 'DB_NAME is required',
  }),
  DB_SYNC: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),
  DB_TENANT_POOL_SIZE: Joi.number().integer().min(2).max(200).default(20),
  DB_CONNECTION_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(5000),
  DB_IDLE_TIMEOUT: Joi.number().integer().min(1000).max(60000).default(10000),
  DB_MAX_LIFETIME: Joi.number()
    .integer()
    .min(60000)
    .max(3600000)
    .default(1800000),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_REFRESH_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('30d'),
  MAIL_HOST: Joi.string().default('localhost'),
  MAIL_PORT: optionalTcpPort,
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASS: Joi.string().allow('').optional(),
  MAIL_FROM_NAME: Joi.string().optional(),
  MAIL_FROM_ADDRESS: Joi.string().optional(),
  APP_URL: Joi.string().uri().optional(),
  ROOT_DOMAIN: Joi.string().hostname().optional(),
  // Host custom domains CNAME to; defaults to `schools.${ROOT_DOMAIN}`.
  CUSTOM_DOMAIN_CNAME_TARGET: Joi.string().hostname().optional(),
  CUSTOM_DOMAIN_MAX_PER_ORG: Joi.number().integer().min(1).default(5),
  // Comma-separated; `https://*.example.com` allows every tenant subdomain.
  CORS_ORIGIN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  // Express `trust proxy` (see config/trust-proxy.ts).
  TRUST_PROXY: Joi.string().optional(),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('api/docs'),
  SWAGGER_TITLE: Joi.string().optional(),
  SWAGGER_DESCRIPTION: Joi.string().optional(),
  HEALTH_DISK_PATH: Joi.string().default('/'),
  HEALTH_DISK_THRESHOLD: Joi.number().min(0).max(1).default(0.9),
  HEALTH_MEMORY_HEAP_BYTES: Joi.number()
    .integer()
    .min(1)
    .default(300 * 1024 * 1024),
  HEALTH_MEMORY_RSS_BYTES: Joi.number()
    .integer()
    .min(1)
    .default(500 * 1024 * 1024),
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_TTL: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  // Background jobs (BullMQ on Redis; `inline` runs them in-process).
  QUEUE_DRIVER: Joi.string().valid('bullmq', 'inline').optional(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  QUEUE_CONCURRENCY: Joi.number().integer().min(1).max(64).default(4),
  // S3-compatible object storage (MinIO in docker compose).
  S3_ENDPOINT: Joi.string().uri().optional(),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('school-erp'),
  }),
  S3_ACCESS_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow('').optional(),
  }),
  S3_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow('').optional(),
  }),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  S3_SIGNED_URL_TTL: Joi.number().integer().min(30).max(86400).default(300),
  UPLOAD_MAX_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(10 * 1024 * 1024),
  // PDF rendering (headless Chrome via Puppeteer).
  PDF_CONCURRENCY: Joi.number().integer().min(1).max(32).default(4),
  PDF_CHROME_PATH: Joi.string().optional(),
  PDF_NO_SANDBOX: Joi.boolean().default(false),
  // `<keyId>:<base64 32-byte key>` for AES-256-GCM field encryption; older
  // keys (same format, comma-separated) stay readable for rotation. Required
  // on every deployed environment (staging too): without it a dev-only key
  // would encrypt real data.
  FIELD_ENCRYPTION_KEY: Joi.string()
    .pattern(FIELD_KEY_PATTERN)
    .when('NODE_ENV', {
      is: Joi.exist().valid('staging', 'production'),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  FIELD_ENCRYPTION_OLD_KEYS: Joi.string()
    .pattern(new RegExp(`^${FIELD_KEY_SOURCE}(,${FIELD_KEY_SOURCE})*$`))
    .optional(),
})
  .unknown(true)
  .prefs({ abortEarly: false });

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envValidationSchema.validate(config, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  });
  const { error } = result;

  if (error) {
    const lines = error.details.map(
      (d) => `${d.path.filter(Boolean).join('.') || '(root)'}: ${d.message}`,
    );
    throw new Error(`Environment validation failed:\n${lines.join('\n')}`);
  }

  return result.value as Record<string, unknown>;
}
