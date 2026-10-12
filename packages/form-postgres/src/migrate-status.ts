import { makePool, MigrationRunner } from "./index.js";

async function main(): Promise<void> {
  const pool = makePool();
  try {
    const runner = new MigrationRunner(pool);
    const status = await runner.status();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(status, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
