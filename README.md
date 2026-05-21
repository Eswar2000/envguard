# envguard

> Type-safe environment variable validator with beautiful errors.
> **Zero dependencies. Edge-runtime compatible. ~2KB gzipped.**

```ts
import { envguard, e } from 'envguard';

export const env = envguard({
  NODE_ENV: e.enum(['development', 'production', 'test']).default('development'),
  PORT: e.port().default(3000),
  DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }),
  REDIS_URL: e.url().optional(),
  JWT_SECRET: e.string().min(32).secret(),
  ENABLE_BETA: e.boolean().default(false),
  ALLOWED_ORIGINS: e.csv(e.url()),
});

env.PORT;        // ✅ number
env.NODE_ENV;    // ✅ 'development' | 'production' | 'test'
env.REDIS_URL;   // ✅ string | undefined
```

## Why?

- **Fails fast at boot.** No more cryptic crashes 10 minutes into production.
- **All errors at once.** Fix every config bug in one restart, not five.
- **Beautiful errors.** Typo suggestions, missing-var examples, masked secrets.
- **Fully typed output.** No more `process.env.X!` defensive non-null asserts.
- **Works anywhere.** Node, Bun, Deno, Cloudflare Workers, Vercel Edge.
- **Zero dependencies.** ~2KB gzipped.

## Install

```bash
npm i envguard
# or: pnpm add envguard / yarn add envguard / bun add envguard
```

## Schema builders

| Builder | Output type | Example raw value |
|---|---|---|
| `e.string()` | `string` | `"hello"` |
| `e.string().min(n).max(n).regex(re)` | `string` | |
| `e.number()` | `number` | `"42"` |
| `e.number().min(n).max(n).int()` | `number` | |
| `e.port()` | `number` (1–65535) | `"8080"` |
| `e.boolean()` | `boolean` | `"true"`, `"1"`, `"yes"`, `"on"` |
| `e.enum(['a','b'])` | `'a' \| 'b'` | `"a"` |
| `e.url({ protocol })` | `string` | `"https://x.com"` |
| `e.csv(e.string())` | `string[]` | `"a,b,c"` |

### Modifiers (chain on any builder)

- `.optional()` — allow missing. Output type becomes `T \| undefined`.
- `.default(value)` — fallback when missing.
- `.secret()` — mask the value in error messages.

## Error output

Given a broken environment:

```bash
PORT=abc
NODE_ENV=prdouction
JWT_SECRET=hunter2
# DATABASE_URL missing
```

You get:

```
✘ envguard: Invalid environment (4 errors)

  ┌─ PORT  = "abc"
  │  ✗ Expected a port number (1-65535), got "abc"
  │
  ┌─ NODE_ENV  = "prdouction"
  │  ✗ Expected one of: development | production | test
  │  → Did you mean "production"?
  │
  ┌─ JWT_SECRET  = "h***2"
  │  ✗ String must be at least 32 characters (got 7)
  │
  ┌─ DATABASE_URL  (required)
  │  ✗ Missing (required)

Fix all errors above and restart.
```

## Edge runtimes

Don't have `process.env`? Pass `source` explicitly:

```ts
// Cloudflare Workers
export default {
  fetch(req: Request, runtimeEnv: Env) {
    const env = envguard(schema, { source: runtimeEnv });
    // ...
  },
};
```

## Error modes

```ts
envguard(schema);                              // throws EnvguardError (default)
envguard(schema, { onError: 'exit' });         // prints and process.exit(1)
const r = envguard(schema, { onError: 'collect' });
if (!r.ok) console.error(r.message);           // returns { ok: false, errors }
```

## License

MIT
