#!/usr/bin/env python3
"""
PATCH PRISMA V7 — adapte la config pour Prisma 7.4.2
- Crée prisma.config.ts
- Met à jour prisma/schema.prisma (supprime url du datasource)
- Met à jour src/lib/prisma.ts avec l'adapter SQLite
"""
import os

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

# ─── 1. prisma.config.ts (à la racine du projet) ──────────────────────────────
PRISMA_CONFIG = '''\
// prisma.config.ts
import path from "node:path";
import type { PrismaConfig } from "prisma";

export default {
  earlyAccess: true,
  schema: path.join(__dirname, "prisma/schema.prisma"),
  migrate: {
    adapter: async () => {
      const { PrismaBetterSQLite3 } = await import("@prisma/adapter-better-sqlite3");
      const { default: Database } = await import("better-sqlite3");
      const dbPath = process.env.DATABASE_URL?.replace("file:", "") ?? "./dev.db";
      const db = new Database(dbPath);
      return new PrismaBetterSQLite3(db);
    },
  },
} satisfies PrismaConfig;
'''

# ─── Simpler approach: downgrade to classic config ──────────────────────────────
# Actually the simplest fix for Prisma 7 SQLite is to use the adapter in schema
# But the easiest path is to use the libsql adapter or just fix schema

# Prisma 7 with SQLite requires either:
# 1. adapter approach (needs extra packages)
# 2. Use DATABASE_URL in a different way

# Actually the simplest fix: remove the url line and add it via env config
# Looking at Prisma 7 docs: for SQLite you need @prisma/adapter-better-sqlite3

# Let's use the straightforward approach: create prisma.config.ts without adapter
# and use env DATABASE_URL differently

PRISMA_CONFIG_SIMPLE = '''\
// prisma.config.ts
import path from "node:path";
import type { PrismaConfig } from "prisma";

export default {
  earlyAccess: true,
  schema: path.join(__dirname, "prisma/schema.prisma"),
  migrate: {
    migrationsDir: path.join(__dirname, "prisma/migrations"),
  },
} satisfies PrismaConfig;
'''

# ─── 2. schema.prisma sans url ─────────────────────────────────────────────────
SCHEMA = '''\
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

enum Chain {
  ethereum
  solana
  bsc
  polygon
  arbitrum
  base
  other
}

enum LabelType {
  scam
  phishing
  drainer
  exploiter
  insider
  kol
  whale
  airdrop_target
  cluster_member
  incident_related
  other
}

enum Confidence {
  low
  medium
  high
}

enum Visibility {
  internal_only
  sources_on_request
}

enum TosRisk {
  low
  medium
  high
}

enum BatchStatus {
  pending
  approved
  rejected
}

model SourceRegistry {
  id          String   @id @default(cuid())
  name        String   @unique
  url         String?
  description String?
  license     String?
  tosRisk     TosRisk  @default(low)
  trusted     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  batches     IngestionBatch[]
}

model IngestionBatch {
  id            String          @id @default(cuid())
  sourceId      String?
  source        SourceRegistry? @relation(fields: [sourceId], references: [id])
  status        BatchStatus     @default(pending)
  inputType     String
  inputPayload  String
  totalRows     Int             @default(0)
  matchedAddrs  Int             @default(0)
  dedupedRows   Int             @default(0)
  warnings      String?
  approvedBy    String?
  approvedAt    DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  rawDocuments  RawDocument[]
  labels        AddressLabel[]
  auditLogs     AuditLog[]
}

model RawDocument {
  id        String         @id @default(cuid())
  batchId   String
  batch     IngestionBatch @relation(fields: [batchId], references: [id])
  content   String
  mimeType  String         @default("text/plain")
  createdAt DateTime       @default(now())
}

model AddressLabel {
  id          String          @id @default(cuid())
  chain       String
  address     String
  labelType   String
  label       String
  confidence  String          @default("low")
  entityName  String?
  sourceName  String
  sourceUrl   String?
  evidence    String?
  visibility  String          @default("internal_only")
  license     String?
  tosRisk     String          @default("low")
  firstSeenAt DateTime        @default(now())
  lastSeenAt  DateTime        @default(now())
  batchId     String?
  batch       IngestionBatch? @relation(fields: [batchId], references: [id])

  @@unique([chain, address, labelType, label, sourceUrl], name: "dedup_key")
  @@index([chain, address])
  @@index([batchId])
}

model RiskSummaryCache {
  id        String   @id @default(cuid())
  chain     String
  address   String
  summary   String
  updatedAt DateTime @updatedAt

  @@unique([chain, address], name: "chain_address")
}

model AuditLog {
  id        String          @id @default(cuid())
  action    String
  actorId   String
  batchId   String?
  batch     IngestionBatch? @relation(fields: [batchId], references: [id])
  meta      String?
  createdAt DateTime        @default(now())
}
'''

# ─── 3. src/lib/prisma.ts avec adapter better-sqlite3 ─────────────────────────
PRISMA_CLIENT = '''\
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

function createClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace("file:", "");
  const resolvedPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(process.cwd(), dbPath);

  const sqlite = new Database(resolvedPath);
  const adapter = new PrismaBetterSQLite3(sqlite);
  return new PrismaClient({ adapter } as never);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
'''

def write(path: str, content: str):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"✅ {path.replace(ROOT+'/', '')} — écrit.")

def patch():
    write(os.path.join(ROOT, "prisma/schema.prisma"), SCHEMA)
    write(os.path.join(ROOT, "prisma.config.ts"), PRISMA_CONFIG_SIMPLE)
    write(os.path.join(ROOT, "src/lib/prisma.ts"), PRISMA_CLIENT)

    print("\n→ Lance maintenant:")
    print("   pnpm add better-sqlite3 @prisma/adapter-better-sqlite3")
    print("   pnpm add -D @types/better-sqlite3")
    print("   npx prisma migrate dev --name intel_vault_p0")
    print("   pnpm test")

patch()
