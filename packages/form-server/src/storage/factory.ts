import type { UploadStorageAdapter } from "./types.js";
import { createFilesystemStorageAdapter } from "./filesystem.js";
import { createS3StorageAdapter } from "./s3.js";

export function createUploadStorageAdapterFromEnv(): UploadStorageAdapter {
  const provider = (process.env.FORM_UPLOAD_PROVIDER ?? "filesystem").toLowerCase();

  if (provider === "filesystem") {
    return createFilesystemStorageAdapter(process.env.FORM_UPLOAD_DIR);
  }

  if (provider === "s3") {
    const bucket = process.env.FORM_S3_BUCKET;
    const region = process.env.FORM_S3_REGION ?? "us-east-1";
    if (!bucket) {
      throw new Error("FORM_S3_BUCKET is required when FORM_UPLOAD_PROVIDER=s3");
    }

    return createS3StorageAdapter({
      bucket,
      region,
      endpoint: process.env.FORM_S3_ENDPOINT,
      forcePathStyle: process.env.FORM_S3_FORCE_PATH_STYLE === "true",
      accessKeyId: process.env.FORM_S3_ACCESS_KEY,
      secretAccessKey: process.env.FORM_S3_SECRET_KEY
    });
  }

  throw new Error(`Unknown FORM_UPLOAD_PROVIDER ${provider}`);
}
