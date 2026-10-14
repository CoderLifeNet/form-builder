import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const mode = process.argv[2] === "minimal" ? "minimal" : "workspace";
const frontendWorkspace = mode === "minimal" ? "example-minimal" : "example-workspace";
const frontendPort = mode === "minimal" ? 4173 : 4175;
const backendPort = Number(process.env.FORM_DEV_PORT ?? 4010);
const defaultDbUrl = "postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder";
const dbUrl = process.env.FORM_DB_URL ?? defaultDbUrl;
const browserUrl = `http://127.0.0.1:${frontendPort}/`;
const apiUrl = `http://127.0.0.1:${backendPort}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const runningChildren = [];
let shuttingDown = false;

function log(channel, message) {
  process.stdout.write(`[${channel}] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`\n[dev] ${message}\n`);
  process.exit(1);
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function requirePrerequisite(command, installHint) {
  if (!commandExists(command)) {
    fail(`${command} is required. ${installHint}`);
  }
}

function checkDockerCompose() {
  const dockerCheck = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (dockerCheck.status !== 0) {
    fail("Docker daemon is not running. Start Docker Desktop and retry.");
  }

  const composeCheck = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  if (composeCheck.status !== 0) {
    fail("docker compose is required. Install Docker Compose v2 and retry.");
  }
}

function parseDbUrl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      fail("FORM_DB_URL must be a PostgreSQL connection string.");
    }
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
      fail(`FORM_DB_URL must point to a local development database. Received host: ${parsed.hostname}`);
    }
    return parsed;
  } catch {
    fail("FORM_DB_URL is not a valid URL. Example: postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder");
  }
}

function runCommand(label, command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim().length) {
          log(label, line);
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim().length) {
          log(label, line);
        }
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

function startLabeledProcess(label, command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().length) {
        log(label, line);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().length) {
        log(label, line);
      }
    }
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    process.stderr.write(`\n[dev] ${label} exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "none"}). Stopping all processes.\n`);
    shutdown(1).catch(() => process.exit(1));
  });

  runningChildren.push({ label, child });
  return child;
}

function waitForPostgresReady(databaseName) {
  return new Promise(async (resolve, reject) => {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        await runCommand("infra", "docker", ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "formbuilder", "-d", databaseName]);
        resolve();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    reject(new Error("PostgreSQL did not become ready within 90 seconds."));
  });
}

function ensurePortAvailable(port, serviceName) {
  return new Promise((resolve, reject) => {
    const tester = createServer();
    tester.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(new Error(`${serviceName} port ${port} is already in use. Stop the existing process or change ports before retrying.\nTip: lsof -nP -iTCP:${port} -sTCP:LISTEN`));
        return;
      }
      reject(error);
    });
    tester.once("listening", () => {
      tester.close(() => resolve());
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("dev", "Shutting down child processes...");
  for (const { child } of runningChildren) {
    if (child.killed) {
      continue;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore kill errors during shutdown.
    }
  }

  setTimeout(() => {
    for (const { child } of runningChildren) {
      if (child.killed) {
        continue;
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore already-exited children.
      }
    }
    process.exit(exitCode);
  }, 1500);
}

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});

async function main() {
  requirePrerequisite("node", "Install Node.js 22.x.");
  requirePrerequisite(npmCommand, "Install npm 10.x with Node.js 22.x.");
  requirePrerequisite("docker", "Install Docker Desktop for macOS and ensure it is running.");
  checkDockerCompose();

  const parsedDb = parseDbUrl(dbUrl);
  const databaseName = parsedDb.pathname.replace(/^\//, "") || "formbuilder";

  await ensurePortAvailable(backendPort, "Backend");
  await ensurePortAvailable(frontendPort, `${mode === "minimal" ? "Minimal example" : "Workspace example"} frontend`);

  log("dev", `Starting ${mode} development workflow...`);
  log("dev", `Using local database ${parsedDb.hostname}:${parsedDb.port || "5432"}/${databaseName}`);

  await runCommand("infra", "docker", ["compose", "up", "-d", "postgres"]);
  await waitForPostgresReady(databaseName);

  log("build", "Building required package artifacts...");
  await runCommand("build", npmCommand, ["run", "build", "-w", "@coderlifenet/form-builder"]);

  log("db", "Applying migrations to local development database...");
  await runCommand("db", npmCommand, ["run", "db:migrate"], { ...process.env, FORM_DB_URL: dbUrl });

  log("dev", "Starting backend and frontend... Press Ctrl+C to stop both.");
  startLabeledProcess("api", npmCommand, ["run", "dev", "-w", "@coderlifenet/form-server"], {
    ...process.env,
    FORM_DB_URL: dbUrl,
    FORM_DEV_AUTH: "true",
    PORT: String(backendPort)
  });

  startLabeledProcess("web", npmCommand, ["run", "dev", "-w", frontendWorkspace, "--", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], {
    ...process.env,
    VITE_FORM_API_BASE_URL: apiUrl
  });

  log("dev", `Workspace URL: ${browserUrl}`);
  log("dev", `API URL: ${apiUrl}`);
  log("dev", "Optional demo seed (explicit): FORM_DB_URL=postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder npm run db:seed");
}

main().catch(async (error) => {
  process.stderr.write(`\n[dev] Startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  await shutdown(1);
});
