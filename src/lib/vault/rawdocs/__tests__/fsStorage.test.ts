import { describe, it, expect, afterAll } from "vitest";
import { fsStorage } from "../fsStorage";
import fs from "fs";
import path from "path";

const BASE = path.join(process.cwd(), "var", "rawdocs");

describe("FSStorage", () => {
  const batchId = "test-batch-fs";

  afterAll(() => {
    fs.rmSync(path.join(BASE, batchId), { recursive: true, force: true });
  });

  it("save + read round-trip", async () => {
    const content = Buffer.from("hello interligens");
    const result = await fsStorage.save(content, { mime: "text/plain", filename: "test.txt", batchId });
    expect(result.storageProvider).toBe("fs");
    expect(result.size).toBe(content.length);
    expect(result.sha256).toHaveLength(64);
    const back = await fsStorage.read(result.storageKey);
    expect(back.toString()).toBe("hello interligens");
  });
});
