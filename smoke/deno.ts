// Smoke-test envguard under Deno.
// Run with:  deno run --allow-env smoke/deno.ts
//
// This imports the BUILT output (dist/) — exactly what npm consumers get.

import { e, envguard } from '../dist/index.js';

const env = envguard(
  {
    PORT: e.port().default(3000),
    NODE_ENV: e.enum(['dev', 'prod']).default('dev'),
    DATABASE_URL: e.url(),
  },
  {
    source: {
      DATABASE_URL: 'https://example.com',
    },
  },
);

console.log('Deno smoke test OK:', env);

// Verify failure path also works.
const r = envguard(
  { PORT: e.port() },
  { source: { PORT: 'abc' }, onError: 'collect' },
);
if (r.ok) throw new Error('expected failure');
console.log('Failure path OK. Sample error:\n', r.message);
