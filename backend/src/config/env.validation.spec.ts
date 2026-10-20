import { envValidationSchema } from './env.validation';

/** Paths of the variables that failed validation for `env`. */
const failures = (env: Record<string, string>) =>
  (
    envValidationSchema.validate(env, { abortEarly: false }).error?.details ??
    []
  ).map((d) => d.path.join('.'));

describe('envValidationSchema FIELD_ENCRYPTION_KEY', () => {
  const key = `k1:${Buffer.alloc(32, 7).toString('base64')}`;

  it.each(['staging', 'production'])('is required when NODE_ENV=%s', (env) => {
    expect(failures({ NODE_ENV: env })).toContain('FIELD_ENCRYPTION_KEY');
    expect(
      failures({ NODE_ENV: env, FIELD_ENCRYPTION_KEY: key }),
    ).not.toContain('FIELD_ENCRYPTION_KEY');
  });

  it.each([['development'], ['test'], [undefined]])(
    'is optional when NODE_ENV=%s',
    (env) => {
      expect(failures(env ? { NODE_ENV: env } : {})).not.toContain(
        'FIELD_ENCRYPTION_KEY',
      );
    },
  );

  it('rejects a malformed key', () => {
    expect(
      failures({ NODE_ENV: 'development', FIELD_ENCRYPTION_KEY: 'nope' }),
    ).toContain('FIELD_ENCRYPTION_KEY');
  });
});
