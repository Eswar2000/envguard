import { formatErrors, type FieldError } from './errors/format.js';
import type { InferShape, Schema } from './schema/types.js';

export { e } from './schema/builders.js';
export type { Infer, InferShape, Schema } from './schema/types.js';

export type EnvSource = Record<string, string | undefined>;

export interface EnvguardOptions {
  /**
   * Where to read values from. Defaults to `process.env` when available,
   * otherwise an empty object (useful for edge runtimes — pass the runtime's
   * `env` argument here).
   */
  source?: EnvSource;
  /**
   * What to do when validation fails.
   *  - 'throw' (default): throw an Error whose message is the formatted report.
   *  - 'exit': print to stderr and call `process.exit(1)`.
   *  - 'collect': return `{ ok: false, errors }` instead of throwing.
   */
  onError?: 'throw' | 'exit' | 'collect';
  /**
   * Label(s) shown in the error footer (e.g. ".env.local, process.env").
   * Purely informational.
   */
  loadedFrom?: string[];
  /**
   * Force-enable or disable ANSI colors in error output.
   */
  color?: boolean;
}

export type EnvguardResult<S extends Record<string, Schema<unknown>>> =
  | { ok: true; env: InferShape<S> }
  | { ok: false; errors: FieldError[]; message: string };

/**
 * Validate environment variables against a schema.
 *
 * @example
 * const env = envguard({
 *   PORT: e.port().default(3000),
 *   DATABASE_URL: e.url(),
 * });
 */
export function envguard<S extends Record<string, Schema<unknown>>>(
  schema: S,
  options?: EnvguardOptions & { onError?: 'throw' | 'exit' },
): InferShape<S>;
export function envguard<S extends Record<string, Schema<unknown>>>(
  schema: S,
  options: EnvguardOptions & { onError: 'collect' },
): EnvguardResult<S>;
export function envguard<S extends Record<string, Schema<unknown>>>(
  schema: S,
  options: EnvguardOptions = {},
): InferShape<S> | EnvguardResult<S> {
  const source: EnvSource =
    options.source ??
    (typeof process !== 'undefined' && process.env ? process.env : {});
  const onError = options.onError ?? 'throw';

  const out: Record<string, unknown> = {};
  const errors: FieldError[] = [];

  for (const key of Object.keys(schema)) {
    const s = schema[key] as Schema<unknown>;
    const raw = source[key];
    const result = s.parse(raw);
    if (result.ok) {
      out[key] = result.value;
    } else {
      errors.push({
        name: key,
        rawValue: raw,
        message: result.message,
        suggestion: result.suggestion,
        isSecret: s._isSecret,
        expected: s._describe,
      });
    }
  }

  if (errors.length === 0) {
    const frozen = Object.freeze(out) as InferShape<S>;
    if (onError === 'collect') {
      return { ok: true, env: frozen } as EnvguardResult<S>;
    }
    return frozen;
  }

  const message = formatErrors(errors, {
    loadedFrom: options.loadedFrom,
    color: options.color,
  });

  if (onError === 'collect') {
    return { ok: false, errors, message };
  }
  if (onError === 'exit') {
    if (typeof process !== 'undefined') {
      process.stderr.write(message + '\n');
      process.exit(1);
    }
  }
  throw new EnvguardError(message, errors);
}

export class EnvguardError extends Error {
  override readonly name = 'EnvguardError';
  constructor(
    message: string,
    public readonly errors: FieldError[],
  ) {
    super(message);
  }
}

export type { FieldError } from './errors/format.js';
export { formatErrors } from './errors/format.js';
