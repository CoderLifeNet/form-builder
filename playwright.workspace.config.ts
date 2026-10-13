import { defineConfig } from "@playwright/test";

const dbUrl = process.env.FORM_TEST_DB_URL ?? "postgres://formbuilder:formbuilder@localhost:55432/formbuilder_test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "workspace-reference.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4185"
  },
  webServer: [
    {
      command: `FORM_DB_URL=${dbUrl} npm run db:migrate && FORM_DEV_AUTH=true FORM_DB_URL=${dbUrl} PORT=4011 node packages/form-server/dist/dev-server.js`,
      url: "http://127.0.0.1:4011/health",
      reuseExistingServer: false
    },
    {
      command: "VITE_FORM_API_BASE_URL=http://127.0.0.1:4011 npm run dev -w example-workspace -- --host 127.0.0.1 --port 4185",
      url: "http://127.0.0.1:4185",
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "workspace-desktop",
      use: { viewport: { width: 1440, height: 1000 } }
    }
  ]
});
