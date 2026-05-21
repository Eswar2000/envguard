// Smoke-test envguard inside a Cloudflare Worker.
// Run with:
//   npm run build
//   npx wrangler dev smoke/worker.ts
//
// Then visit http://localhost:8787 in a browser.
// You should see the typed env JSON. There is NO `process.env` in Workers —
// envguard reads from the runtime's `env` argument instead.

import { e, envguard } from '../dist/index.js';

interface Env {
  API_KEY?: string;
  ALLOWED_ORIGIN?: string;
}

export default {
  fetch(_req: Request, runtimeEnv: Env): Response {
    try {
      const env = envguard(
        {
          API_KEY: e.string().min(8).secret(),
          ALLOWED_ORIGIN: e.url().default('https://example.com'),
        },
        { source: runtimeEnv as Record<string, string | undefined> },
      );
      return Response.json({ ok: true, env });
    } catch (err) {
      return new Response((err as Error).message, { status: 500 });
    }
  },
};
