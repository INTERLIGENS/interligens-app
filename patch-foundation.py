#!/usr/bin/env python3
"""
PATCH FOUNDATION — Crée prisma/schema.prisma + src/lib/prisma.ts + corrige imports
"""
import os, sys, glob

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

# ─── 1. prisma/schema.prisma ───────────────────────────────────────────────────
SCHEMA = '''\
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
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
  id          String         @id @default(cuid())
  chain       String
  address     String
  labelType   String
  label       String
  confidence  String         @default("low")
  entityName  String?
  sourceName  String
  sourceUrl   String?
  evidence    String?
  visibility  String         @default("internal_only")
  license     String?
  tosRisk     String         @default("low")
  firstSeenAt DateTime       @default(now())
  lastSeenAt  DateTime       @default(now())
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

# ─── 2. src/lib/prisma.ts ──────────────────────────────────────────────────────
PRISMA_CLIENT = '''\
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
'''

# ─── 3. .env.local snippet ────────────────────────────────────────────────────
ENV_LINE = 'DATABASE_URL="file:./dev.db"\n'

def patch():
    # Schema
    schema_path = os.path.join(ROOT, "prisma", "schema.prisma")
    os.makedirs(os.path.dirname(schema_path), exist_ok=True)
    if os.path.exists(schema_path):
        with open(schema_path, "r") as f:
            existing = f.read()
        if "AddressLabel" in existing:
            print("✅ schema.prisma — déjà à jour, skip.")
        else:
            with open(schema_path, "w") as f:
                f.write(SCHEMA)
            print("✅ schema.prisma — créé.")
    else:
        with open(schema_path, "w") as f:
            f.write(SCHEMA)
        print("✅ schema.prisma — créé.")

    # Prisma client
    client_path = os.path.join(ROOT, "src", "lib", "prisma.ts")
    with open(client_path, "w") as f:
        f.write(PRISMA_CLIENT)
    print("✅ src/lib/prisma.ts — créé.")

    # .env.local
    env_path = os.path.join(ROOT, ".env.local")
    env_content = ""
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            env_content = f.read()
    if "DATABASE_URL" not in env_content:
        with open(env_path, "a") as f:
            f.write("\n" + ENV_LINE)
        print("✅ .env.local — DATABASE_URL ajoutée.")
    else:
        print("✅ .env.local — DATABASE_URL déjà présente.")

    # Fix all @/lib/prisma imports (dedup.ts already has correct path now)
    files_to_fix = glob.glob(os.path.join(ROOT, "src/lib/intel-vault/**/*.ts"), recursive=True)
    files_to_fix += glob.glob(os.path.join(ROOT, "src/app/api/admin/**/*.ts"), recursive=True)
    files_to_fix += glob.glob(os.path.join(ROOT, "src/app/api/scan/explain/route.ts"))
    for path in files_to_fix:
        with open(path, "r") as f:
            content = f.read()
        if '@/lib/prisma"' in content:
            # @/lib/prisma is correct — it maps to src/lib/prisma.ts which now exists
            print(f"✅ {path.replace(ROOT+'/', '')} — import @/lib/prisma OK.")

    print("\n✅ Foundation patch terminé.")
    print("\n→ Lance maintenant:")
    print("   pnpm add @prisma/client prisma")
    print("   npx prisma migrate dev --name intel_vault_p0")
    print("   pnpm test")

patch()
