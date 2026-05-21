import type { ParseResult, Schema } from './types.js';

/**
 * Internal base class used by every builder. Holds shared flags and
 * implements the `.optional()`, `.default()`, `.secret()` modifiers.
 */
abstract class BaseSchema<T> implements Schema<T> {
  declare readonly _output: T;
  readonly _isOptional: boolean = false;
  readonly _hasDefault: boolean = false;
  readonly _isSecret: boolean = false;
  protected _defaultValue: T | undefined = undefined;
  abstract readonly _describe: string;

  abstract _parseValue(raw: string): ParseResult<T>;

  parse(raw: string | undefined): ParseResult<T> {
    if (raw === undefined || raw === '') {
      if (this._hasDefault) return { ok: true, value: this._defaultValue as T };
      if (this._isOptional) return { ok: true, value: undefined as T };
      return { ok: false, message: 'Missing (required)' };
    }
    return this._parseValue(raw);
  }

  optional(): Schema<T | undefined> {
    const clone = Object.create(this) as this;
    (clone as { _isOptional: boolean })._isOptional = true;
    return clone as unknown as Schema<T | undefined>;
  }

  default(value: T): Schema<T> {
    const clone = Object.create(this) as this;
    (clone as { _hasDefault: boolean })._hasDefault = true;
    clone._defaultValue = value;
    return clone;
  }

  secret(): this {
    const clone = Object.create(this) as this;
    (clone as { _isSecret: boolean })._isSecret = true;
    return clone;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// string
// ─────────────────────────────────────────────────────────────────────────────

interface StringOpts {
  min?: number;
  max?: number;
  regex?: RegExp;
}

class StringSchema extends BaseSchema<string> {
  override readonly _describe = 'string';
  constructor(private readonly opts: StringOpts = {}) {
    super();
  }
  _parseValue(raw: string): ParseResult<string> {
    if (this.opts.min !== undefined && raw.length < this.opts.min) {
      return {
        ok: false,
        message: `String must be at least ${this.opts.min} characters (got ${raw.length})`,
      };
    }
    if (this.opts.max !== undefined && raw.length > this.opts.max) {
      return {
        ok: false,
        message: `String must be at most ${this.opts.max} characters (got ${raw.length})`,
      };
    }
    if (this.opts.regex && !this.opts.regex.test(raw)) {
      return { ok: false, message: `String does not match pattern ${this.opts.regex}` };
    }
    return { ok: true, value: raw };
  }
  min(n: number): StringSchema {
    return new StringSchema({ ...this.opts, min: n });
  }
  max(n: number): StringSchema {
    return new StringSchema({ ...this.opts, max: n });
  }
  regex(re: RegExp): StringSchema {
    return new StringSchema({ ...this.opts, regex: re });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// number
// ─────────────────────────────────────────────────────────────────────────────

interface NumberOpts {
  min?: number;
  max?: number;
  int?: boolean;
}

class NumberSchema extends BaseSchema<number> {
  override readonly _describe = 'number';
  constructor(private readonly opts: NumberOpts = {}) {
    super();
  }
  _parseValue(raw: string): ParseResult<number> {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { ok: false, message: `Expected a number, got "${raw}"` };
    }
    if (this.opts.int && !Number.isInteger(n)) {
      return { ok: false, message: `Expected an integer, got ${n}` };
    }
    if (this.opts.min !== undefined && n < this.opts.min) {
      return { ok: false, message: `Number must be >= ${this.opts.min} (got ${n})` };
    }
    if (this.opts.max !== undefined && n > this.opts.max) {
      return { ok: false, message: `Number must be <= ${this.opts.max} (got ${n})` };
    }
    return { ok: true, value: n };
  }
  min(n: number): NumberSchema {
    return new NumberSchema({ ...this.opts, min: n });
  }
  max(n: number): NumberSchema {
    return new NumberSchema({ ...this.opts, max: n });
  }
  int(): NumberSchema {
    return new NumberSchema({ ...this.opts, int: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// port
// ─────────────────────────────────────────────────────────────────────────────

class PortSchema extends BaseSchema<number> {
  override readonly _describe = 'port (1-65535)';
  _parseValue(raw: string): ParseResult<number> {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      return { ok: false, message: `Expected a port number (1-65535), got "${raw}"` };
    }
    return { ok: true, value: n };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// boolean
// ─────────────────────────────────────────────────────────────────────────────

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'n', 'off', '']);

class BooleanSchema extends BaseSchema<boolean> {
  override readonly _describe = 'boolean';
  _parseValue(raw: string): ParseResult<boolean> {
    const v = raw.toLowerCase().trim();
    if (TRUTHY.has(v)) return { ok: true, value: true };
    if (FALSY.has(v)) return { ok: true, value: false };
    return {
      ok: false,
      message: `Expected a boolean (true/false/1/0/yes/no), got "${raw}"`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// enum
// ─────────────────────────────────────────────────────────────────────────────

class EnumSchema<const T extends readonly string[]> extends BaseSchema<T[number]> {
  override readonly _describe: string;
  constructor(private readonly values: T) {
    super();
    this._describe = `one of: ${values.join(' | ')}`;
  }
  _parseValue(raw: string): ParseResult<T[number]> {
    if ((this.values as readonly string[]).includes(raw)) {
      return { ok: true, value: raw as T[number] };
    }
    const suggestion = closest(raw, this.values as readonly string[]);
    return {
      ok: false,
      message: `Expected ${this._describe}, got "${raw}"`,
      ...(suggestion ? { suggestion: `Did you mean "${suggestion}"?` } : {}),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// url
// ─────────────────────────────────────────────────────────────────────────────

interface UrlOpts {
  protocol?: readonly string[];
}

class UrlSchema extends BaseSchema<string> {
  override readonly _describe: string;
  constructor(private readonly opts: UrlOpts = {}) {
    super();
    this._describe = opts.protocol
      ? `URL (${opts.protocol.join('/')})`
      : 'URL';
  }
  _parseValue(raw: string): ParseResult<string> {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return { ok: false, message: `Not a valid URL: "${raw}"` };
    }
    if (this.opts.protocol) {
      const got = parsed.protocol.replace(/:$/, '');
      if (!this.opts.protocol.includes(got)) {
        return {
          ok: false,
          message: `URL protocol must be one of ${this.opts.protocol.join('/')}, got "${got}"`,
        };
      }
    }
    return { ok: true, value: raw };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// csv (comma-separated list of another schema's items)
// ─────────────────────────────────────────────────────────────────────────────

class CsvSchema<T> extends BaseSchema<T[]> {
  override readonly _describe: string;
  constructor(private readonly item: Schema<T>) {
    super();
    this._describe = `comma-separated ${item._describe}`;
  }
  _parseValue(raw: string): ParseResult<T[]> {
    const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const out: T[] = [];
    for (let i = 0; i < parts.length; i++) {
      const r = this.item.parse(parts[i]);
      if (!r.ok) {
        return { ok: false, message: `Item [${i}] "${parts[i]}": ${r.message}` };
      }
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Levenshtein "did you mean" helper
// ─────────────────────────────────────────────────────────────────────────────

function closest(input: string, candidates: readonly string[]): string | undefined {
  let best: { word: string; dist: number } | undefined;
  for (const c of candidates) {
    const d = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (d <= Math.max(2, Math.floor(c.length / 3))) {
      if (!best || d < best.dist) best = { word: c, dist: d };
    }
  }
  return best?.word;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(
        curr + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
      prev[j - 1] = curr;
      curr = next;
    }
    prev[b.length] = curr;
  }
  return prev[b.length] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public builder namespace `e`
// ─────────────────────────────────────────────────────────────────────────────

export const e = {
  string: (opts?: StringOpts) => new StringSchema(opts),
  number: (opts?: NumberOpts) => new NumberSchema(opts),
  port: () => new PortSchema(),
  boolean: () => new BooleanSchema(),
  enum: <const T extends readonly string[]>(values: T) => new EnumSchema(values),
  url: (opts?: UrlOpts) => new UrlSchema(opts),
  csv: <T>(item: Schema<T>) => new CsvSchema(item),
};
