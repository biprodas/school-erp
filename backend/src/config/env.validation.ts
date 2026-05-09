import Joi from 'joi';

const optionalTcpPort = Joi.any().custom((value, helpers) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    return helpers.error('any.invalid');
  }
  return n;
});

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid(
    'development',
    'staging',
    'production',
    'test',
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
  DB_NAME: Joi.string().trim().min(1).required().messages({
    'string.empty': 'DB_NAME is required',
    'any.required': 'DB_NAME is required',
  }),
  DB_SYNC: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),
  DB_TENANT_POOL_SIZE: Joi.number().integer().min(2).max(200).default(20),
  DB_CONNECTION_TIMEOUT: Joi.number().integer().min(1000).max(30000).default(5000),
  DB_IDLE_TIMEOUT: Joi.number().integer().min(1000).max(60000).default(10000),
  DB_MAX_LIFETIME: Joi.number().integer().min(60000).max(3600000).default(1800000),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  CORS_ORIGIN: Joi.string().optional(),
})
  .unknown(true)
  .prefs({ abortEarly: false });

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  });

  if (error) {
    const lines = error.details.map(
      (d) => `${d.path.filter(Boolean).join('.') || '(root)'}: ${d.message}`,
    );
    throw new Error(`Environment validation failed:\n${lines.join('\n')}`);
  }

  return value as Record<string, unknown>;
}
