// src/lib/storage/types.ts

export type StorageEnv = "production" | "preview" | "development";

export interface PdfUploadInput {
  buffer: Buffer;
  subject: string;
  batchId?: string;
}

export interface PdfUploadResult {
  key: string;
  signedUrl: string;
  sizeBytes: number;
  sha256: string;
}
