import { defineConfig } from '@playwright/test';

// End-to-end and responsive tests against the real static build under /Buchungssystem/ and the
// Firebase emulators. Run everything with `npm run test:e2e` (starts the emulators itself).
// With emulators already running (`npm run emu`): `npx playwright test`.
const PORT = 4174;

export default defineConfig({
  testDir: 'tests/e2e',
  // One shared emulator database: tests reseed it, so they run one after another.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite build --mode emu --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Buchungssystem/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
