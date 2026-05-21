/**
 * Internal: result of parsing a single env var.
 */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; suggestion?: string };

/**
 * Base schema interface. Each builder returns one of these.
 * `_output` is a phantom type used by `Infer<S>` for static typing.
 */
export interface Schema<T> {
  readonly _output: T;
  readonly _isOptional: boolean;
  readonly _hasDefault: boolean;
  readonly _isSecret: boolean;
  readonly _describe: string;
  parse(raw: string | undefined): ParseResult<T>;
}

/**
 * Extract the output type from a schema.
 */
export type Infer<S> = S extends Schema<infer T> ? T : never;

/**
 * Extract the output shape of an envguard schema map.
 */
export type InferShape<S extends Record<string, Schema<unknown>>> = {
  [K in keyof S]: Infer<S[K]>;
};
