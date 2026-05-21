# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Eswar2000/envguard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Eswar2000/envguard/releases/tag/v0.1.0
