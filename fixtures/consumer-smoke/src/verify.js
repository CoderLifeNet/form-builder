import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..", "..");
const packsDir = path.join(root, "tmp", "packs");

if (!fs.existsSync(packsDir)) {
  console.error("Missing packed artifacts directory tmp/packs");
  process.exit(1);
}

const expected = [
  "coderlifenet-form-core-0.1.0.tgz",
  "coderlifenet-form-postgres-0.1.0.tgz",
  "coderlifenet-form-server-0.1.0.tgz",
  "coderlifenet-form-react-0.1.0.tgz",
  "coderlifenet-form-builder-0.1.0.tgz"
];

for (const file of expected) {
  const full = path.join(packsDir, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing packed artifact ${file}`);
    process.exit(1);
  }
}

console.log("Consumer fixture verified tarball artifacts are present");
