import { envguard, type FieldError } from '../../index.js';
import { loadEnvFile } from '../loadEnvFile.js';
import { CliError, loadSchema } from '../loadSchema.js';

export interface CheckOptions {
  schema?: string;
  envFile?: string;
  format: 'pretty' | 'json';
  quiet: boolean;
  cwd?: string;
}

export interface CheckResult {
  ok: boolean;
  /** Text to write to stdout (may be empty in --quiet mode). */
  output: string;
  /** Process exit code: 0 = ok, 1 = validation failed, 2 = usage error. */
  exitCode: 0 | 1 | 2;
}

/**
 * Run the `envguard check` command.
 *
 * Pure-ish: returns a `CheckResult` instead of writing to stdout/stderr or
 * calling `process.exit`, so it's trivially testable.
 */
export async function runCheck(opts: CheckOptions): Promise<CheckResult> {
  let schema, schemaPath;
  try {
    ({ schema, path: schemaPath } = await loadSchema(opts.schema, opts.cwd));
  } catch (err) {
    if (err instanceof CliError) {
      return { ok: false, output: err.message, exitCode: 2 };
    }
    throw err;
  }

  let source: Record<string, string | undefined>;
  let loadedFrom: string[];
  if (opts.envFile) {
    try {
      source = loadEnvFile(opts.envFile);
      loadedFrom = [opts.envFile];
    } catch (err) {
      return {
        ok: false,
        output: `Failed to read env file: ${opts.envFile}\n${(err as Error).message}`,
        exitCode: 2,
      };
    }
  } else {
    source = process.env;
    loadedFrom = ['process.env'];
  }

  const result = envguard(schema, {
    source,
    loadedFrom,
    onError: 'collect',
    // Force JSON output to have no ANSI codes; let pretty output auto-detect.
    ...(opts.format === 'json' ? { color: false } : {}),
  });

  if (result.ok) {
    if (opts.quiet) return { ok: true, output: '', exitCode: 0 };
    if (opts.format === 'json') {
      return {
        ok: true,
        output: JSON.stringify(
          { ok: true, schema: schemaPath, loadedFrom },
          null,
          2,
        ),
        exitCode: 0,
      };
    }
    return {
      ok: true,
      output: `✔ envguard: ${Object.keys(schema).length} variables OK (schema: ${schemaPath})`,
      exitCode: 0,
    };
  }

  if (opts.quiet) return { ok: false, output: '', exitCode: 1 };
  if (opts.format === 'json') {
    return {
      ok: false,
      output: JSON.stringify(
        {
          ok: false,
          schema: schemaPath,
          loadedFrom,
          errors: result.errors.map(serializeError),
        },
        null,
        2,
      ),
      exitCode: 1,
    };
  }
  return { ok: false, output: result.message, exitCode: 1 };
}

function serializeError(err: FieldError) {
  return {
    name: err.name,
    rawValue: err.rawValue ?? null,
    message: err.message,
    expected: err.expected,
    isSecret: err.isSecret,
    ...(err.suggestion ? { suggestion: err.suggestion } : {}),
  };
}
