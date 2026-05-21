/**
 * Run with:  pnpm example   (or: npx tsx examples/basic.ts)
 *
 * Try breaking it:
 *   PORT=abc NODE_ENV=prdouction pnpm example
 */
import { e, envguard } from '../src/index.js';

const env = envguard(
  {
    NODE_ENV: e.enum(['development', 'production', 'test']).default('development'),
    PORT: e.port().default(3000),
    DATABASE_URL: e.url({ protocol: ['postgres', 'postgresql'] }),
    REDIS_URL: e.url().optional(),
    JWT_SECRET: e.string().min(32).secret(),
    ENABLE_BETA: e.boolean().default(false),
    ALLOWED_ORIGINS: e.csv(e.url()),
  },
  {
    // For demo purposes we pass an inline source. In a real app, omit this
    // and envguard reads from process.env automatically.
    source: {
      DATABASE_URL: 'postgresql://app:pw@localhost:5432/myapp',
      JWT_SECRET: 'this-is-a-very-long-secret-key-12345',
      ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com',
      ...process.env,
    },
    loadedFrom: ['.env.local', 'process.env'],
    onError: 'exit',
  },
);

console.log('✔ Environment validated');
console.log(env);
