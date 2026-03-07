// src/lib/vault/rawdocs/fsStorage.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { RawDocsStorage, StorageResult } from "./storage";

const BASE_DIR = path.join(process.cwd(), "var", "rawdocs");

export const fsStorage: RawDocsStorage = {
  async save(buffer, { mime, filename, batchId }) {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = path.extname(filename) || ".bin";
    const dir = path.join(BASE_DIR, batchId);
    fs.mkdirSync(dir, { recursive: true });
    const storageKey = path.join(batchId, `${sha256}${ext}`);
    fs.writeFileSync(path.join(BASE_DIR, storageKey), buffer);
    return { storageProvider: "fs", storageKey, size: buffer.length, sha256 };
  },
  async read(storageKey) {
    return fs.readFileSync(path.join(BASE_DIR, storageKey));
  },
};
