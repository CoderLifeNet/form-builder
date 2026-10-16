import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { publishTarball } from "./publish-tarball.mjs";

const publish = process.argv.includes("--publish");
const dryRun = process.argv.includes("--dry-run");
const verifyOnly = process.argv.includes("--verify-only");
const checkAvailable = process.argv.includes("--available");
assert.ok(!(publish && dryRun), "Choose publication or dry-run, not both");

const manifest = JSON.parse(readFileSync("packages/form-builder/package.json", "utf8"));
assert.equal(manifest.name, "@coderlifenet/form-builder", "Only @coderlifenet/form-builder is authorized");
const expectedRepositoryUrl = "https://github.com/CoderLifeNet/form-builder";
const filename = `${manifest.name.slice(1).replace("/", "-")}-${manifest.version}.tgz`;
const tarball = path.resolve("tmp/packs", filename);
const bytes = readFileSync(tarball);
const packed = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");

assert.equal(packed.name, manifest.name);
assert.equal(packed.version, manifest.version);
assert.match(packed.version, /^\d+\.\d+\.\d+-alpha\.\d+$/);
assert.equal(packed.private, false);
assert.equal(packed.license, "MIT");
assert.equal(packed.repository?.url, expectedRepositoryUrl);
assert.equal(packed.publishConfig?.access, "public");
assert.equal(packed.publishConfig?.tag, "alpha");
assert.equal(packed.publishConfig?.provenance, true);

for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  for (const specifier of Object.values(packed[section] ?? {})) {
    assert.ok(!/^(file:|link:|workspace:|\/|\.\.?\/|[A-Za-z]:[\\/])/.test(specifier), `Nonportable ${section}: ${specifier}`);
  }
}

for (const entry of entries) {
  assert.ok(!entry.split("/").includes(".."), `Unsafe path: ${entry}`);
  assert.ok(/^package\/(dist\/|package\.json$|README\.md$|LICENSE$)/.test(entry), `Outside publish allowlist: ${entry}`);
}
for (const required of ["package.json", "README.md", "LICENSE"]) {
  assert.ok(entries.includes(`package/${required}`), `Missing required publish file: ${required}`);
}

function checkTarget(target) {
  if (typeof target === "string") {
    const normalized = target.startsWith("./") ? target.slice(2) : target;
    assert.ok(!normalized.startsWith("/"), `Export target must be package-relative: ${target}`);
    assert.ok(entries.includes(`package/${normalized}`), `Missing export target in tarball: ${target}`);
  } else {
    for (const nested of Object.values(target)) {
      checkTarget(nested);
    }
  }
}
checkTarget(packed.exports);
checkTarget(packed.types);
checkTarget(packed.main);

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const report = {
  name: packed.name,
  version: packed.version,
  sourceCommit,
  filename,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  files: entries.length
};

const releasePath = path.resolve("artifacts", "release.json");
if (publish || verifyOnly) {
  const expected = JSON.parse(readFileSync(releasePath, "utf8"));
  assert.deepEqual(report, expected, "Artifact identity does not match validated source and bytes");
} else {
  mkdirSync(path.dirname(releasePath), { recursive: true });
  writeFileSync(releasePath, `${JSON.stringify(report, null, 2)}\n`);
}

if (checkAvailable || publish) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packed.name)}`);
  if (response.status === 200) {
    const metadata = await response.json();
    assert.ok(!metadata.versions?.[packed.version], "Version already published; never overwrite");
  } else {
    assert.equal(response.status, 404, "Registry availability check failed");
    console.log("No public package visible; this does not prove scope access or name availability for this identity.");
  }
}

if (publish || dryRun) {
  publishTarball(tarball, { dryRun });
}

console.log(JSON.stringify(report, null, 2));
