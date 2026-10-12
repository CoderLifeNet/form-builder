import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import type { DownloadResult, UploadStorageAdapter } from "./types.js";

export type S3AdapterOptions = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
};

function ensureBodyStream(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }
  if (body && typeof (body as Readable).pipe === "function") {
    return body as Readable;
  }
  throw new Error("S3_OBJECT_STREAM_MISSING");
}

export function createS3StorageAdapter(options: S3AdapterOptions): UploadStorageAdapter {
  const config: S3ClientConfig = {
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle
  };

  if (options.accessKeyId && options.secretAccessKey) {
    config.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    };
  }

  const client = new S3Client(config);

  return {
    async storeObject(input): Promise<{ objectKey: string; sizeBytes: number }> {
      const key = `${input.tenantId}/${input.uploadId}-${randomBytes(6).toString("hex")}`;
      let bytes = 0;
      input.stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
      });

      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: input.stream,
          ContentType: input.contentType
        })
      );

      return { objectKey: key, sizeBytes: bytes };
    },

    async getObject(input): Promise<DownloadResult> {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: options.bucket,
          Key: input.objectKey
        })
      );

      return {
        stream: ensureBodyStream(object.Body),
        sizeBytes: input.sizeBytes,
        contentType: input.contentType
      };
    },

    async deleteObject(input): Promise<void> {
      await client.send(
        new DeleteObjectCommand({
          Bucket: options.bucket,
          Key: input.objectKey
        })
      );
    }
  };
}
