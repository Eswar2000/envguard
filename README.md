# envguard

A small TypeScript library that validates `process.env` against a schema and
hands you back a typed object. If anything is missing or malformed, it tells
you exactly what — all of it, at once — and refuses to let the app start.

```ts
import { envguard, e } from '@eswar2000/envguard';

const env = envguard({
  NODE_ENV: e.enum(['development', 'production', 'test']).default('development'),
  PORT: e.port().default(3000),
  DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }),
  REDIS_URL: e.url().optional(),
  JWT_SECRET: e.string().min(32).secret(),
  ENABLE_BETA: e.boolean().default(false),
  ALLOWED_ORIGINS: e.csv(e.url()),
});

env.PORT;          // number
env.NODE_ENV;      // 'development' | 'production' | 'test'
env.REDIS_URL;     // string | undefined
```

If something's wrong, you get a single, readable failure report on stderr
instead of a crash six layers deep:

```
✘ envguard: Invalid environment (4 errors)

  ┌─ PORT  = "abc"
  │  ✗ Expected a port number (1-65535), got "abc"
  │
  ┌─ NODE_ENV  = "prdouction"
  │  ✗ Expected one of: development | production | test
  │  → Did you mean "production"?
  │
  ┌─ JWT_SECRET  = "h*****2"
  │  ✗ String must be at least 32 characters (got 7)
  │
  ┌─ DATABASE_URL  (required)
  │  ✗ Missing (required)
```

## Install

```sh
npm install @eswar2000/envguard
```

Requires Node 18+. Works in Bun, Deno, and edge runtimes (Cloudflare Workers,
Vercel Edge) — see [Edge runtimes](#edge-runtimes) below.

## Builders

All builders live on the `e` namespace.

| Builder                | Returns        | Reads from env as              |
| ---------------------- | -------------- | ------------------------------ |
| `e.string()`           | `string`       | any                            |
| `e.number()`           | `number`       | `"42"`, `"3.14"`               |
| `e.port()`             | `number`       | `"8080"` (1–65535)             |
| `e.boolean()`          | `boolean`      | `true/false/1/0/yes/no/on/off` |
| `e.enum([...])`        | union literal  | one of the listed strings      |
| `e.url({ protocol })`  | `string`       | `https://...`                  |
| `e.csv(item)`          | `T[]`          | `"a,b,c"`                      |

Builders with constraints:

```ts
e.string().min(8).max(64).regex(/^[A-Z0-9_]+$/)
e.number().int().min(1).max(100)
e.url({ protocol: ['https'] })
e.csv(e.url())
```

Modifiers (chainable on any builder):

- `.optional()` — allow missing; output type becomes `T | undefined`.
- `.default(value)` — value to use when the var is missing or empty.
- `.secret()` — mask this value in error messages.

A var is treated as "missing" when it's `undefined` *or* the empty string,
which matches how shells and `.env` files behave in practice.

## Error handling

By default, `envguard` throws an `EnvguardError` whose `message` is the
formatted report. You can change that:

```ts
// throws (default) — good for libraries, gives you a stack trace
envguard(schema);

// prints to stderr and process.exit(1) — good for CLIs and server entry points
envguard(schema, { onError: 'exit' });

// returns { ok: false, errors, message } instead of throwing — good for tests
const r = envguard(schema, { onError: 'collect' });
if (!r.ok) {
  console.error(r.message);
  console.error(r.errors); // structured, one entry per failing var
}
```

## CLI

For CI pipelines and local pre-flight checks, envguard ships a small zero-dep
CLI. Define a schema file once and reuse it everywhere.

```sh
# env.schema.mjs (or .js / .cjs)
import { e } from '@eswar2000/envguard';

export default {
  PORT: e.port().default(3000),
  DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }),
  JWT_SECRET: e.string().min(32).secret(),
};
```

```sh
# Validate process.env against ./env.schema.mjs
npx envguard check

# Validate a .env file (CI pre-deploy check, or local .env.production)
npx envguard check -e .env.production

# Machine-readable output for build tooling
npx envguard check --format json
```

Flags:

| Flag                      | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `--schema <path>`         | Schema file path. Defaults to auto-discovering           |
|                           | `env.schema.{js,mjs,cjs}` in the current directory.      |
| `-e, --env <path>`        | Read env from a `.env` file instead of `process.env`.    |
| `--format <pretty\|json>` | Output format. Default `pretty`.                         |
| `--quiet`                 | Suppress stdout; rely on the exit code only.             |
| `-h, --help`              | Show usage.                                              |
| `-v, --version`           | Show CLI version.                                        |

Exit codes:

- `0` — all variables valid.
- `1` — validation failed (one or more variables are missing or malformed).
- `2` — usage or configuration error (bad flag, missing schema file,
  unreadable env file).

Drop it into any CI step that should block on a bad config:

```yaml
# .github/workflows/deploy.yml
- name: Validate production env
  run: npx envguard check -e .env.production
```

> The CLI deliberately uses `--env` (not `--env-file`) because Node 20.6+
> consumes `--env-file` as a built-in flag before the script sees it.

## Edge runtimes

There's no `process.env` in Workers / Edge. Pass `source` explicitly:

```ts
// Cloudflare Workers
export default {
  fetch(req: Request, runtimeEnv: Env) {
    const env = envguard(schema, {
      source: runtimeEnv as Record<string, string | undefined>,
    });
    // ...
  },
};
```

Same trick is useful in tests, where you want a deterministic environment
instead of leaking in whatever's in your shell:

```ts
const env = envguard(schema, {
  source: { PORT: '3000', DATABASE_URL: 'postgresql://localhost/test' },
});
```

## Secret masking

Fields marked `.secret()` have their value masked in any error output:

```ts
e.string().min(32).secret()
// "hunter2" → "h*****2" in error messages
```

As a safety net, values are also masked automatically when the var name
matches `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `PASS`, `PWD`, `DSN`, or
`CREDENTIAL` (case-insensitive). For names that don't match the pattern,
add `.secret()` explicitly.

## Scope

This library does one thing: parse and validate a map of strings against a
schema, with good errors. It deliberately doesn't:

- Load `.env` files from the library API — use [`dotenv`](https://www.npmjs.com/package/dotenv)
  or Node's built-in `--env-file` flag and pipe the result in. (The bundled
  [CLI](#cli) does read `.env` files, since that's its job.)
- Reload at runtime — env is read once, at startup.
- Wrap or replace `process.env` — the returned object is independent.

## Prior art

- [`envalid`](https://github.com/af/envalid) — the long-standing option, and
  the inspiration for the API shape here. envguard differs in error UX
  (all-at-once, typo suggestions, secret masking), zero dependencies, and
  edge-runtime safety.
- [`znv`](https://github.com/lostfictions/znv) — Zod-based, smaller scope.
- [`@t3-oss/env-core`](https://github.com/t3-oss/t3-env) — great if you're
  already on the T3 stack; heavier and more opinionated.

If one of those fits, use it. envguard exists for projects that want
something small, runtime-portable, and friendlier when things break.

## License

MIT
