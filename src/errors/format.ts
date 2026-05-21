import { looksLikeSecret, maskSecret } from './mask.js';

export interface FieldError {
  name: string;
  rawValue: string | undefined;
  message: string;
  suggestion?: string;
  isSecret: boolean;
  expected: string;
}

export interface FormatOpts {
  loadedFrom?: string[];
  color?: boolean;
}

/**
 * Build the multi-error message shown to the user when validation fails.
 * Pure function — easy to snapshot-test.
 */
export function formatErrors(errors: FieldError[], opts: FormatOpts = {}): string {
  const c = makeColors(opts.color ?? supportsColor());
  const lines: string[] = [];
  lines.push('');
  lines.push(c.red(`✘ envguard: Invalid environment (${errors.length} error${errors.length === 1 ? '' : 's'})`));
  lines.push('');

  for (const err of errors) {
    const display = renderValue(err);
    const header = display === null
      ? `  ┌─ ${c.bold(err.name)}  ${c.dim('(required)')}`
      : `  ┌─ ${c.bold(err.name)}  = ${c.yellow(display)}`;
    lines.push(header);
    lines.push(`  │  ${c.red('✗')} ${err.message}`);
    if (err.suggestion) {
      lines.push(`  │  ${c.cyan('→')} ${err.suggestion}`);
    }
    lines.push('  │');
  }

  // Remove trailing "  │"
  if (lines[lines.length - 1] === '  │') lines.pop();

  if (opts.loadedFrom?.length) {
    lines.push('');
    lines.push(c.dim(`Loaded from: ${opts.loadedFrom.join(', ')}`));
  }
  lines.push(c.dim('Fix all errors above and restart.'));
  lines.push('');
  return lines.join('\n');
}

function renderValue(err: FieldError): string | null {
  if (err.rawValue === undefined) return null;
  const isSecret = err.isSecret || looksLikeSecret(err.name);
  const v = isSecret ? maskSecret(err.rawValue) : err.rawValue;
  return JSON.stringify(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny inline ANSI helpers (no deps).
// ─────────────────────────────────────────────────────────────────────────────

interface Colors {
  red(s: string): string;
  yellow(s: string): string;
  cyan(s: string): string;
  dim(s: string): string;
  bold(s: string): string;
}

function makeColors(enabled: boolean): Colors {
  if (!enabled) {
    const id = (s: string) => s;
    return { red: id, yellow: id, cyan: id, dim: id, bold: id };
  }
  const wrap = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[0m`;
  return {
    red: wrap(31),
    yellow: wrap(33),
    cyan: wrap(36),
    dim: wrap(2),
    bold: wrap(1),
  };
}

function supportsColor(): boolean {
  if (typeof process === 'undefined') return false;
  if (process.env['NO_COLOR']) return false;
  if (process.env['FORCE_COLOR']) return true;
  return Boolean(process.stderr && process.stderr.isTTY);
}
