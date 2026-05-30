# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-30

### Added

- **CLI**: a new `envguard` binary, designed for CI pipelines and local
  pre-flight checks. Zero new runtime dependencies.
  - `envguard check` validates env vars against a schema file
    (`env.schema.{js,mjs,cjs}` auto-discovered in the current directory,
    or pass `--schema <path>`).
  - `-e, --env <path>` reads vars from a `.env` file instead of
    `process.env`. The parser handles quoted values, escape sequences,
    `export ` prefixes, and inline `#` comments.
  - `--format <pretty|json>` chooses human-readable or machine-readable
    output. JSON output is stable and includes the schema path, env
    source, and structured `errors`.
  - `--quiet` suppresses stdout for exit-code-only usage.
  - Exit codes: `0` success, `1` validation failed, `2` usage / config
    error (bad flag, missing schema file, unreadable env file, etc.).
- `formatErrors` is now exported from the library entry so callers can
  format a `FieldError[]` themselves (useful when you take `onError:
  'collect'` results and render them in your own UI).

### Fixed

- `envguard(..., { onError: 'collect' })` now correctly returns
  `{ ok: true, env }` on success. Previously it returned the raw env
  object, which contradicted both the documentation and the TypeScript
  return type.

### Changed

- The build now emits two entry points:
  - `dist/index.{js,cjs}` — library (dual ESM + CJS, unchanged).
  - `dist/cli/index.js` — CLI (ESM-only, with a `#!/usr/bin/env node`
    shebang). Wired up via the package's `bin` field.
- `npm test` now runs `npm run build` first, so CLI end-to-end tests
  spawn a fresh bundle.

## [0.1.0] - 2026-05-21

### Added

- Initial release.
- Schema builders: `string`, `number`, `port`, `boolean`, `enum`, `url`, `csv`.
- Modifiers: `.optional()`, `.default(value)`, `.secret()`.
- Full TypeScript inference for the returned env object.
- Multi-error reporting (all errors at once, not one-by-one).
- Levenshtein-based typo suggestions for enum mismatches.
- Secret masking — explicit via `.secret()` and automatic by name pattern
  (`SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `DSN`, etc.).
- Error modes: `throw` (default), `exit`, `collect`.
- Edge-runtime safe via explicit `source` option (Cloudflare Workers,
  Vercel Edge, Deno, Bun, Node 18+).
- Zero runtime dependencies.

[Unreleased]: https://github.com/Eswar2000/envguard/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Eswar2000/envguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Eswar2000/envguard/releases/tag/v0.1.0
