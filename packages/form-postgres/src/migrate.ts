import { makePool, MigrationRunner } from "./index.js";

async function main(): Promise<void> {
  const pool = makePool();
  try {
    const runner = new MigrationRunner(pool);
    await runner.migrate();
    // eslint-disable-next-line no-console
    console.log("Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
