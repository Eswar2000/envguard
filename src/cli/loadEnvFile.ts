import { readFileSync } from 'node:fs';

/**
 * Minimal `.env` parser — no dependencies.
 *
 * Supports:
 *  - `KEY=value`
 *  - `KEY="value with spaces"`
 *  - `KEY='value with spaces'`
 *  - blank lines and `#` comments
 *  - inline comments after unquoted values (`KEY=value # comment`)
 *  - escape sequences in double-quoted values: `\n`, `\r`, `\t`, `\\`, `\"`
 *
 * Deliberately does NOT support:
 *  - variable expansion (`${OTHER_KEY}`)
 *  - multi-line values
 *  - `export` prefix (silently accepted; ignored)
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = contents.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    // Strip optional `export ` prefix.
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;

    const eq = body.indexOf('=');
    if (eq === -1) continue;

    const key = body.slice(0, eq).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = body.slice(eq + 1).trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = unescapeDoubleQuoted(value.slice(1, -1));
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      // Unquoted: strip trailing inline comment.
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    out[key] = value;
  }

  return out;
}

function unescapeDoubleQuoted(s: string): string {
  return s.replace(/\\(.)/g, (_, ch: string) => {
    switch (ch) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '\\': return '\\';
      case '"': return '"';
      default: return ch;
    }
  });
}

/**
 * Read and parse a `.env` file at the given path. Throws if the file is
 * missing or unreadable.
 */
export function loadEnvFile(path: string): Record<string, string> {
  const contents = readFileSync(path, 'utf8');
  return parseEnvFile(contents);
}
