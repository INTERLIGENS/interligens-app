// src/lib/vault/rawdocs/storage.ts
export interface StorageResult {
  storageProvider: "fs" | "s3";
  storageKey: string;
  size: number;
  sha256: string;
}

export interface RawDocsStorage {
  save(buffer: Buffer, opts: { mime: string; filename: string; batchId: string }): Promise<StorageResult>;
  read(storageKey: string): Promise<Buffer>;
}
