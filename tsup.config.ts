import { defineConfig } from 'tsup';

export default defineConfig([
  // Library entry — dual ESM + CJS, no shebang.
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: 'es2022',
    treeshake: true,
  },
  // CLI entry — ESM only with a Node shebang.
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    minify: false,
    target: 'es2022',
    treeshake: true,
    banner: { js: '#!/usr/bin/env node' },
  },
]);
