/**
 * SHA-256 hashing — the fixed point of the chain of custody.
 * Computed on the file AS-IS, before any transformation.
 */
import { createHash } from "crypto";
import { createReadStream } from "fs";

/** Stream a file and return its lowercase hex SHA-256. Never mutates the file. */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    const s = createReadStream(filePath);
    s.on("error", reject);
    s.on("data", (chunk) => h.update(chunk));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

/** SHA-256 (hex) of an in-memory buffer/string (used for manifests, derivatives). */
export function sha256Buffer(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
