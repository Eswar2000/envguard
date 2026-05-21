import { describe, expect, it } from 'vitest';
import { e, envguard, EnvguardError } from '../src/index.js';

describe('envguard - happy path', () => {
  it('returns a typed object with coerced values', () => {
    const env = envguard(
      {
        PORT: e.port(),
        NODE_ENV: e.enum(['development', 'production', 'test']),
        DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }),
        ENABLE_BETA: e.boolean().default(false),
        ORIGINS: e.csv(e.url()),
      },
      {
        source: {
          PORT: '8080',
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          ORIGINS: 'https://a.com,https://b.com',
        },
      },
    );

    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('production');
    expect(env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/db');
    expect(env.ENABLE_BETA).toBe(false);
    expect(env.ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('applies defaults when value is missing', () => {
    const env = envguard(
      { PORT: e.port().default(3000) },
      { source: {} },
    );
    expect(env.PORT).toBe(3000);
  });

  it('returns undefined for optional missing values', () => {
    const env = envguard(
      { REDIS_URL: e.url().optional() },
      { source: {} },
    );
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('parses booleans from common truthy/falsy strings', () => {
    const cases: Array<[string, boolean]> = [
      ['true', true], ['1', true], ['yes', true], ['ON', true],
      ['false', false], ['0', false], ['no', false], ['off', false],
    ];
    for (const [raw, expected] of cases) {
      const env = envguard({ X: e.boolean() }, { source: { X: raw } });
      expect(env.X).toBe(expected);
    }
  });
});

describe('envguard - failure path', () => {
  it('throws on missing required var', () => {
    expect(() =>
      envguard({ DATABASE_URL: e.url() }, { source: {} }),
    ).toThrow(EnvguardError);
  });

  it('reports all errors at once', () => {
    const result = envguard(
      {
        PORT: e.port(),
        NODE_ENV: e.enum(['development', 'production', 'test']),
        DATABASE_URL: e.url(),
      },
      {
        source: { PORT: 'abc', NODE_ENV: 'prdouction' },
        onError: 'collect',
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(3);
      const names = result.errors.map((e) => e.name).sort();
      expect(names).toEqual(['DATABASE_URL', 'NODE_ENV', 'PORT']);
    }
  });

  it('suggests typo corrections for enums', () => {
    const result = envguard(
      { NODE_ENV: e.enum(['development', 'production', 'test']) },
      { source: { NODE_ENV: 'prdouction' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.suggestion).toContain('production');
    }
  });

  it('validates URL protocol', () => {
    const result = envguard(
      { DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }) },
      { source: { DATABASE_URL: 'mysql://x' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
  });

  it('validates string min length', () => {
    const result = envguard(
      { JWT_SECRET: e.string().min(32) },
      { source: { JWT_SECRET: 'short' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('at least 32');
    }
  });

  it('validates number range', () => {
    const result = envguard(
      { WORKERS: e.number().min(1).max(64) },
      { source: { WORKERS: '99' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
  });

  it('reports CSV item errors with index', () => {
    const result = envguard(
      { ORIGINS: e.csv(e.url()) },
      { source: { ORIGINS: 'https://a.com,not-a-url,https://b.com' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('[1]');
    }
  });

  it('treats empty string as missing', () => {
    const result = envguard(
      { DATABASE_URL: e.url() },
      { source: { DATABASE_URL: '' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('envguard - secret masking', () => {
  it('masks values for fields marked .secret()', () => {
    const result = envguard(
      { JWT_SECRET: e.string().min(32).secret() },
      { source: { JWT_SECRET: 'hunter2' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain('hunter2');
      expect(result.message).toMatch(/h\*+2/);
    }
  });

  it('auto-masks values for fields with secret-y names', () => {
    const result = envguard(
      { API_TOKEN: e.string().min(40) },
      { source: { API_TOKEN: 'leaked-token-value' }, onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain('leaked-token-value');
    }
  });
});

describe('envguard - type inference (compile-time)', () => {
  it('infers correct TypeScript types', () => {
    const env = envguard(
      {
        PORT: e.port(),
        NODE_ENV: e.enum(['dev', 'prod'] as const),
        REDIS_URL: e.url().optional(),
        ENABLE: e.boolean().default(true),
      },
      { source: { PORT: '3000', NODE_ENV: 'dev' } },
    );

    // These assertions exist mostly to lock in inferred types at compile time.
    const _port: number = env.PORT;
    const _node: 'dev' | 'prod' = env.NODE_ENV;
    const _redis: string | undefined = env.REDIS_URL;
    const _enable: boolean = env.ENABLE;
    expect([_port, _node, _redis, _enable]).toBeDefined();
  });
});
