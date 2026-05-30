import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../src/cli/loadEnvFile.js';

describe('parseEnvFile', () => {
  it('parses simple KEY=value lines', () => {
    expect(parseEnvFile('FOO=bar\nBAZ=qux\n')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores blank lines and # comments', () => {
    const src = `
# top comment
FOO=bar

# another
BAZ=qux
`;
    expect(parseEnvFile(src)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips inline comments from unquoted values', () => {
    expect(parseEnvFile('FOO=bar # inline\n')).toEqual({ FOO: 'bar' });
  });

  it('preserves # inside quoted values', () => {
    expect(parseEnvFile('FOO="bar # not a comment"\n')).toEqual({
      FOO: 'bar # not a comment',
    });
  });

  it('handles double-quoted values with escapes', () => {
    expect(parseEnvFile('FOO="line1\\nline2"\n')).toEqual({ FOO: 'line1\nline2' });
    expect(parseEnvFile('FOO="say \\"hi\\""\n')).toEqual({ FOO: 'say "hi"' });
  });

  it('handles single-quoted values literally', () => {
    expect(parseEnvFile("FOO='line1\\nline2'\n")).toEqual({ FOO: 'line1\\nline2' });
  });

  it('accepts optional `export ` prefix', () => {
    expect(parseEnvFile('export FOO=bar\n')).toEqual({ FOO: 'bar' });
  });

  it('skips malformed keys', () => {
    expect(parseEnvFile('123BAD=x\nFOO=ok\n')).toEqual({ FOO: 'ok' });
    expect(parseEnvFile('NO_EQUALS_HERE\nFOO=ok\n')).toEqual({ FOO: 'ok' });
  });

  it('treats empty value as empty string (envguard later treats as missing)', () => {
    expect(parseEnvFile('FOO=\n')).toEqual({ FOO: '' });
  });
});
