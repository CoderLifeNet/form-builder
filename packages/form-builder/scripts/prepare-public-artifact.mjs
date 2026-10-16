import fs from "node:fs";
import path from "node:path";

const packageRoot = process.cwd();
const workspaceRoot = path.resolve(packageRoot, "..", "..");

const copyTargets = [
  { from: path.join(workspaceRoot, "packages/form-core/dist"), to: path.join(packageRoot, "dist/core") },
  { from: path.join(workspaceRoot, "packages/form-react/dist"), to: path.join(packageRoot, "dist/renderer") },
  { from: path.join(workspaceRoot, "packages/form-postgres/dist"), to: path.join(packageRoot, "dist/postgres") },
  { from: path.join(workspaceRoot, "packages/form-server/dist"), to: path.join(packageRoot, "dist/server") }
];

for (const target of copyTargets) {
  if (!fs.existsSync(target.from)) {
    throw new Error(`Missing build output: ${target.from}. Build workspace packages before preparing public artifact.`);
  }
  fs.rmSync(target.to, { recursive: true, force: true });
  fs.cpSync(target.from, target.to, { recursive: true });
}

const replacements = [
  { from: "@coderlifenet/form-core", to: "@coderlifenet/form-builder/core" },
  { from: "@coderlifenet/form-react", to: "@coderlifenet/form-builder/renderer" },
  { from: "@coderlifenet/form-postgres", to: "@coderlifenet/form-builder/postgres" },
  { from: "@coderlifenet/form-server", to: "@coderlifenet/form-builder/server" }
];

rewriteTree(path.join(packageRoot, "dist"));

function rewriteTree(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteTree(absolutePath);
      continue;
    }
    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) {
      continue;
    }

    const original = fs.readFileSync(absolutePath, "utf8");
    let next = original;
    for (const replacement of replacements) {
      next = next.split(replacement.from).join(replacement.to);
    }
    if (next !== original) {
      fs.writeFileSync(absolutePath, next);
    }
  }
}

console.log("Prepared @coderlifenet/form-builder public artifact with builder, renderer, core, server, and postgres subpaths.");
