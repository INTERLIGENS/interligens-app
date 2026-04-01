/**
 * src/lib/investigator/seedAccess.ts
 *
 * Utility to create investigator access codes.
 * Run via: npx tsx src/lib/investigator/seedAccess.ts
 *
 * Usage:
 *   npx tsx src/lib/investigator/seedAccess.ts create "BA-01" "Board advisor"
 *   npx tsx src/lib/investigator/seedAccess.ts create "nda-tester-03" "NDA beta tester"
 *   npx tsx src/lib/investigator/seedAccess.ts list
 *   npx tsx src/lib/investigator/seedAccess.ts revoke <accessId>
 *   npx tsx src/lib/investigator/seedAccess.ts regenerate <accessId>
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashSHA256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

async function createAccess(label: string, notes?: string) {
  const code = randomBytes(16).toString("hex"); // 32-char hex code
  const codeHash = hashSHA256(code);

  const access = await prisma.investigatorAccess.create({
    data: {
      label,
      accessCodeHash: codeHash,
      notes: notes ?? null,
    },
  });

  console.log("\n=== NEW INVESTIGATOR ACCESS ===");
  console.log(`  ID:    ${access.id}`);
  console.log(`  Label: ${access.label}`);
  console.log(`  Code:  ${code}`);
  console.log(`  Notes: ${access.notes ?? "(none)"}`);
  console.log("\n  >>> SAVE THIS CODE. It will NOT be shown again. <<<\n");
}

async function listAccesses() {
  const accesses = await prisma.investigatorAccess.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sessions: true } },
    },
  });

  console.log("\n=== INVESTIGATOR ACCESSES ===\n");
  for (const a of accesses) {
    const status = a.isActive ? "\x1b[32mACTIVE\x1b[0m" : "\x1b[31mINACTIVE\x1b[0m";
    const expired = a.expiresAt && a.expiresAt < new Date() ? " \x1b[33m(EXPIRED)\x1b[0m" : "";
    console.log(`  [${a.id}] ${a.label} — ${status}${expired}`);
    console.log(`    Created:  ${a.createdAt.toISOString()}`);
    console.log(`    LastUsed: ${a.lastUsedAt?.toISOString() ?? "never"}`);
    console.log(`    Sessions: ${a._count.sessions}`);
    if (a.notes) console.log(`    Notes:    ${a.notes}`);
    console.log();
  }
}

async function revokeAccess(accessId: string) {
  await prisma.investigatorAccess.update({
    where: { id: accessId },
    data: { isActive: false },
  });
  await prisma.investigatorSession.updateMany({
    where: { investigatorAccessId: accessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log(`\nAccess ${accessId} revoked. All sessions invalidated.\n`);
}

async function regenerateCode(accessId: string) {
  const newCode = randomBytes(16).toString("hex");
  const newHash = hashSHA256(newCode);

  await prisma.investigatorAccess.update({
    where: { id: accessId },
    data: { accessCodeHash: newHash },
  });
  await prisma.investigatorSession.updateMany({
    where: { investigatorAccessId: accessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log("\n=== REGENERATED ACCESS CODE ===");
  console.log(`  ID:       ${accessId}`);
  console.log(`  New Code: ${newCode}`);
  console.log(`\n  >>> All previous sessions invalidated. <<<\n`);
}

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "create":
      if (!args[0]) {
        console.error("Usage: seedAccess.ts create <label> [notes]");
        process.exit(1);
      }
      await createAccess(args[0], args[1]);
      break;
    case "list":
      await listAccesses();
      break;
    case "revoke":
      if (!args[0]) {
        console.error("Usage: seedAccess.ts revoke <accessId>");
        process.exit(1);
      }
      await revokeAccess(args[0]);
      break;
    case "regenerate":
      if (!args[0]) {
        console.error("Usage: seedAccess.ts regenerate <accessId>");
        process.exit(1);
      }
      await regenerateCode(args[0]);
      break;
    default:
      console.log("Commands: create <label> [notes], list, revoke <id>, regenerate <id>");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
