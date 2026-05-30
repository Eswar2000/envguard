import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runCheck } from './commands/check.js';

const HELP = `\
envguard — validate environment variables against a schema

Usage:
  envguard <command> [options]

Commands:
  check                 Validate env vars against a schema file. Exits 1
                        on validation failure, 2 on bad usage.

Options for \`check\`:
  --schema <path>       Path to schema file (default: ./env.schema.js,
                        .mjs, or .cjs in the current directory).
  -e, --env <path>      Read env from a .env file instead of process.env.
                        (Avoids collision with Node's built-in --env-file.)
  --format <pretty|json>  Output format. Default: pretty.
  --quiet               Suppress stdout; rely on the exit code only.

Other:
  -h, --help            Show this help.
  -v, --version         Show CLI version.

Examples:
  envguard check
  envguard check --schema config/env.js
  envguard check --env .env.production
  envguard check -e .env.production --format json
`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(HELP);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write(`${getVersion()}\n`);
    return 0;
  }

  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case 'check':
      return runCheckCommand(rest);
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 2;
  }
}

async function runCheckCommand(args: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        schema: { type: 'string' },
        env: { type: 'string', short: 'e' },
        format: { type: 'string', default: 'pretty' },
        quiet: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (parsed.values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const format = parsed.values.format;
  if (format !== 'pretty' && format !== 'json') {
    process.stderr.write(`Invalid --format value: "${format}" (expected "pretty" or "json")\n`);
    return 2;
  }

  const result = await runCheck({
    schema: parsed.values.schema,
    envFile: parsed.values.env,
    format,
    quiet: parsed.values.quiet ?? false,
  });

  if (result.output) {
    const stream = result.ok ? process.stdout : process.stderr;
    stream.write(result.output);
    if (!result.output.endsWith('\n')) stream.write('\n');
  }

  return result.exitCode;
}

function getVersion(): string {
  // This file is bundled to dist/cli/index.js, so package.json is two levels up.
  try {
    const url = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// Always run when executed as a script. This file is the package's `bin`
// entry, so it has no other consumers.
main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`Unexpected error: ${(err as Error).stack ?? err}\n`);
    process.exit(1);
  },
);
