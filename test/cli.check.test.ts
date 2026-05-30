import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// End-to-end CLI tests. We spawn Node against the BUILT dist/cli/index.js,
// which is exactly what `npx envguard` runs in production. This bypasses
// Vitest/Vite's dynamic-import interception and gives true confidence.
//
// `npm run build` must run before these tests. The npm `test` script is
// chained with build via package.json; CI also runs build first.

const CLI = resolve('dist/cli/index.js');
const SCHEMA_DIR = resolve('test/fixtures/cli');

function runCli(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

let envDir: string;

beforeEach(() => {
  envDir = mkdtempSync(join(tmpdir(), 'envguard-env-'));
});

afterEach(() => {
  rmSync(envDir, { recursive: true, force: true });
});

describe('cli check - happy path (e2e)', () => {
  it('exits 0 when all vars validate', () => {
    const envFile = join(envDir, '.env.test');
    writeFileSync(
      envFile,
      'DATABASE_URL=https://example.com\nJWT_SECRET=longenoughsecret\n',
    );
    const r = runCli(['check', '--env', envFile], SCHEMA_DIR);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('variables OK');
  });

  it('returns JSON output on success when --format=json', () => {
    const envFile = join(envDir, '.env.test');
    writeFileSync(
      envFile,
      'DATABASE_URL=https://example.com\nJWT_SECRET=longenoughsecret\n',
    );
    const r = runCli(['check', '--env', envFile, '--format', 'json'], SCHEMA_DIR);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as { ok: boolean; loadedFrom: string[] };
    expect(parsed.ok).toBe(true);
    expect(parsed.loadedFrom[0]).toContain('.env.test');
  });

  it('emits no stdout in --quiet mode on success', () => {
    const envFile = join(envDir, '.env.test');
    writeFileSync(
      envFile,
      'DATABASE_URL=https://example.com\nJWT_SECRET=longenoughsecret\n',
    );
    const r = runCli(['check', '--env', envFile, '--quiet'], SCHEMA_DIR);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('cli check - failure path (e2e)', () => {
  it('exits 1 when validation fails and masks secrets', () => {
    const envFile = join(envDir, '.env.test');
    writeFileSync(envFile, 'DATABASE_URL=not-a-url\nJWT_SECRET=short\n');
    const r = runCli(['check', '--env', envFile], SCHEMA_DIR);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('DATABASE_URL');
    expect(r.stderr).toContain('JWT_SECRET');
    expect(r.stderr).not.toContain('"short"');
  });

  it('returns structured JSON errors when --format=json', () => {
    const envFile = join(envDir, '.env.test');
    writeFileSync(envFile, 'DATABASE_URL=not-a-url\nJWT_SECRET=short\n');
    const r = runCli(['check', '--env', envFile, '--format', 'json'], SCHEMA_DIR);
    expect(r.code).toBe(1);
    const parsed = JSON.parse(r.stderr) as {
      ok: boolean;
      errors: Array<{ name: string; isSecret?: boolean }>;
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toHaveLength(2);
    const names = parsed.errors.map((e) => e.name).sort();
    expect(names).toEqual(['DATABASE_URL', 'JWT_SECRET']);
    expect(parsed.errors.find((e) => e.name === 'JWT_SECRET')?.isSecret).toBe(true);
  });
});

describe('cli check - usage errors (e2e)', () => {
  it('exits 2 when schema file is missing', () => {
    const r = runCli(['check'], envDir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('No schema file found');
  });

  it('exits 2 when env-file is missing', () => {
    const r = runCli(
      ['check', '--env', join(envDir, 'does-not-exist.env')],
      SCHEMA_DIR,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Failed to read env file');
  });

  it('rejects .ts schema files with a helpful message', () => {
    const tsDir = mkdtempSync(join(tmpdir(), 'envguard-ts-'));
    writeFileSync(join(tsDir, 'env.schema.ts'), 'export default {};');
    try {
      const r = runCli(['check'], tsDir);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('TypeScript schema files are not supported');
    } finally {
      rmSync(tsDir, { recursive: true, force: true });
    }
  });

  it('rejects an invalid --format value', () => {
    const r = runCli(['check', '--format', 'yaml'], SCHEMA_DIR);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Invalid --format value');
  });

  it('shows help with --help', () => {
    const r = runCli(['--help'], SCHEMA_DIR);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('envguard');
  });

  it('shows version with --version', () => {
    const r = runCli(['--version'], SCHEMA_DIR);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d/);
  });
});
