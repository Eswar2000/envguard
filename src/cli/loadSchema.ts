import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Schema } from '../schema/types.js';

export type SchemaModule = Record<string, Schema<unknown>>;

const DEFAULT_CANDIDATES = [
  'env.schema.js',
  'env.schema.mjs',
  'env.schema.cjs',
  'env.schema.ts',
];

/**
 * Locate and dynamic-import the user's schema file.
 *
 * - If `explicit` is given, use it as-is (resolved against cwd).
 * - Otherwise, search the current working directory for any of:
 *   env.schema.{js,mjs,cjs,ts}
 *
 * The schema file must `export default` an object whose values are envguard
 * builders (e.g. `e.string()`, `e.port()`).
 */
export async function loadSchema(
  explicit: string | undefined,
  cwd: string = process.cwd(),
): Promise<{ schema: SchemaModule; path: string }> {
  const path = explicit
    ? resolve(cwd, explicit)
    : findDefault(cwd);

  if (!path) {
    throw new CliError(
      `No schema file found. Looked for: ${DEFAULT_CANDIDATES.join(', ')} in ${cwd}.\n` +
        `Pass --schema <path> to specify one explicitly.`,
    );
  }

  if (!existsSync(path)) {
    throw new CliError(`Schema file not found: ${path}`);
  }

  if (path.endsWith('.ts')) {
    throw new CliError(
      `TypeScript schema files are not supported directly yet.\n` +
        `Compile to .js first, or run via tsx:\n` +
        `  npx tsx node_modules/.bin/envguard check`,
    );
  }

  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(path).href)) as { default?: unknown };
  } catch (err) {
    throw new CliError(
      `Failed to load schema file: ${path}\n${(err as Error).message}`,
    );
  }

  const schema = mod.default;
  if (!schema || typeof schema !== 'object') {
    throw new CliError(
      `Schema file must \`export default\` an object: ${path}`,
    );
  }

  return { schema: schema as SchemaModule, path };
}

function findDefault(cwd: string): string | undefined {
  for (const name of DEFAULT_CANDIDATES) {
    const p = resolve(cwd, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * CLI errors that should be reported as user-facing messages (exit 2)
 * rather than crashing with a stack trace.
 */
export class CliError extends Error {
  override readonly name = 'CliError';
}
