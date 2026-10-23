// Bundles functions/src + ../shared into one file. firebase-admin/functions stay external.
import { build } from 'esbuild';

await build({
  entryPoints: ['functions/src/index.ts'],
  outfile: 'functions/lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions'],
  logLevel: 'warning',
});
console.log('functions built');
