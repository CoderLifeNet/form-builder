import { spawn } from "node:child_process";

if (!process.env.FORM_TEST_DB_URL) {
  console.error("Set FORM_TEST_DB_URL to a dedicated disposable test database. FORM_DB_URL is deliberately ignored.");
  process.exit(1);
}
const connection = new URL(process.env.FORM_TEST_DB_URL);
if (!["postgres:", "postgresql:"].includes(connection.protocol)) {
  console.error("FORM_TEST_DB_URL must be a PostgreSQL connection string.");
  process.exit(1);
}
const run = args => new Promise(resolve => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    env: { ...process.env, FORM_RUN_DB_TESTS: "true" }
  });
  child.on("error", error => { console.error(error.message); resolve(1); });
  child.on("exit", code => resolve(code ?? 1));
});
// Connect to an existing test DB; this command never starts Docker or a DB server.
const persistence = await run(["run", "test", "-w", "@coderlifenet/form-postgres"]);
const api = await run(["run", "test", "-w", "@coderlifenet/form-server", "--", "src/acceptance.integration.test.ts"]);
process.exitCode = persistence || api;
