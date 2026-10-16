import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

export function publishTarball(tarball, { dryRun = false, execute = execFileSync } = {}) {
  const resolved = path.resolve(tarball);
  assert.ok(statSync(resolved).isFile(), `Release tarball must be a file: ${resolved}`);
  assert.equal(path.extname(resolved), ".tgz", "Release artifact must be a .tgz file");
  const args = ["publish", resolved, "--ignore-scripts", "--access", "public", "--tag", "alpha", "--registry", "https://registry.npmjs.org/"];
  args.push(...(dryRun ? ["--dry-run", "--provenance=false"] : ["--provenance"]));
  execute("npm", args, { stdio: "inherit" });
}
