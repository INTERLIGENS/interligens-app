// src/lib/vault/rawdocs/getStorage.ts
import { env, hasS3 } from "@/lib/config/env";
import { fsStorage } from "./fsStorage";
import { s3Storage } from "./s3Storage";
import type { RawDocsStorage } from "./storage";

export function getRawDocsStorage(): RawDocsStorage {
  if (env.RAWDOCS_STORAGE === "s3" && hasS3()) return s3Storage;
  return fsStorage;
}
