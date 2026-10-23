import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'shared'), '@': resolve(__dirname, 'src') } },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts'] },
});
