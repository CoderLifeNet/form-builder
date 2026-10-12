import { Readable } from "node:stream";

export type UploadStoreResult = {
  objectKey: string;
  sizeBytes: number;
};

export type DownloadResult = {
  stream: Readable;
  sizeBytes: number;
  contentType: string;
};

export type UploadStorageAdapter = {
  storeObject: (input: {
    tenantId: string;
    uploadId: string;
    fileName: string;
    contentType: string;
    stream: Readable;
  }) => Promise<UploadStoreResult>;
  getObject: (input: {
    tenantId: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<DownloadResult>;
  deleteObject: (input: { tenantId: string; objectKey: string }) => Promise<void>;
};
