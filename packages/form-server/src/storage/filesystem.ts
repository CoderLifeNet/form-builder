import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import type { DownloadResult, UploadStorageAdapter } from "./types.js";

function sanitizeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function ensureUnderRoot(rootPath: string, absolutePath: string): void {
  if (!absolutePath.startsWith(rootPath + path.sep) && absolutePath !== rootPath) {
    throw new Error("STORAGE_PATH_ESCAPE");
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true, mode: 0o700 });
}

export function createFilesystemStorageAdapter(rootDir = process.env.FORM_UPLOAD_DIR ?? path.resolve(".form_uploads/private")): UploadStorageAdapter {
  return {
    async storeObject(input): Promise<{ objectKey: string; sizeBytes: number }> {
      const safeTenant = sanitizeName(input.tenantId);
      const root = path.resolve(rootDir);
      const tmpDir = path.join(root, ".tmp");
      const tenantDir = path.join(root, safeTenant);
      await ensureDir(tmpDir);
      await ensureDir(tenantDir);

      const rootReal = await realpath(root);
      const suffix = randomBytes(6).toString("hex");
      const objectKey = `${safeTenant}/${input.uploadId}-${suffix}`;
      const finalPath = path.resolve(path.join(root, objectKey));
      ensureUnderRoot(rootReal, finalPath);

      const tmpPath = path.join(tmpDir, `${input.uploadId}-${suffix}.tmp`);
      let bytes = 0;
      input.stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
      });

      await pipeline(input.stream, createWriteStream(tmpPath, { flags: "wx", mode: 0o600 }));
      await rename(tmpPath, finalPath);

      return { objectKey, sizeBytes: bytes };
    },

    async getObject(input): Promise<DownloadResult> {
      const root = path.resolve(rootDir);
      const rootReal = await realpath(root);
      const filePath = path.resolve(path.join(root, input.objectKey));
      ensureUnderRoot(rootReal, filePath);
      return {
        stream: createReadStream(filePath),
        sizeBytes: input.sizeBytes,
        contentType: input.contentType
      };
    },

    async deleteObject(input): Promise<void> {
      const root = path.resolve(rootDir);
      const rootReal = await realpath(root);
      const filePath = path.resolve(path.join(root, input.objectKey));
      ensureUnderRoot(rootReal, filePath);
      await rm(filePath, { force: true });
    }
  };
}
