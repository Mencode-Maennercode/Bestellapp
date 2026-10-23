import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'shared'), '@': resolve(import.meta.dirname, 'src') } },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
