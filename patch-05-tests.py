#!/usr/bin/env python3
"""
PATCH 05 — Intel Vault: Tests Vitest
Couvre: parser CSV, sheet URL convert, regex address, dedup merge logic,
scan lookup, wearekent mapping.
Idempotent.
"""
import os, sys

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

FILES = {}

FILES["src/lib/intel-vault/__tests__/address.test.ts"] = '''\
import { describe, it, expect } from "vitest";
import { detectChain, isValidAddress, pickAddressColumn } from "../address";

describe("address detection", () => {
  it("détecte ethereum pour 0x addresses", () => {
    expect(detectChain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe("ethereum");
  });

  it("détecte solana pour base58 long", () => {
    expect(detectChain("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb")).toBe("solana");
  });

  it("retourne other pour invalide", () => {
    expect(detectChain("not-an-address")).toBe("other");
  });

  it("valide une adresse EVM", () => {
    expect(isValidAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true);
  });

  it("invalide une adresse trop courte", () => {
    expect(isValidAddress("0xdeadbeef")).toBe(false);
  });

  it("isValidAddress false pour chaîne vide", () => {
    expect(isValidAddress("")).toBe(false);
  });
});

describe("pickAddressColumn", () => {
  it("retourne la colonne avec le plus d'adresses EVM", () => {
    const headers = ["name", "address", "amount"];
    const rows = [
      ["Alice", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "1.5"],
      ["Bob", "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", "2.0"],
      ["Charlie", "not-an-addr", "0.5"],
    ];
    expect(pickAddressColumn(headers, rows)).toBe(1);
  });

  it("retourne -1 si aucune adresse valide", () => {
    const headers = ["a", "b"];
    const rows = [["x", "y"], ["z", "w"]];
    expect(pickAddressColumn(headers, rows)).toBe(-1);
  });
});
'''

FILES["src/lib/intel-vault/__tests__/parsers.test.ts"] = '''\
import { describe, it, expect } from "vitest";
import { parseCsv } from "../parsers/csv";
import { parseJson } from "../parsers/json";
import { parseText } from "../parsers/text";
import { toExportUrl } from "../parsers/sheet";

const OPTS = {
  sourceName: "test",
  label: "test_label",
  defaultLabelType: "other" as const,
  visibility: "internal_only" as const,
};

// ── CSV parser ──────────────────────────────────────────────────────────────────
describe("parseCsv", () => {
  it("parse un CSV simple avec colonne address", () => {
    const csv = `address,amount\\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.5\\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B,2.0`;
    const result = parseCsv(csv, OPTS);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].chain).toBe("ethereum");
    expect(result.rows[0].label).toBe("test_label");
    expect(result.warnings).toHaveLength(0);
  });

  it("ignore les lignes sans adresse valide", () => {
    const csv = `address,name\\nnot-valid,Alice\\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,Bob`;
    const result = parseCsv(csv, OPTS);
    expect(result.rows).toHaveLength(1);
  });

  it("extrait evidence eth/usd/rank pour wearekent-style", () => {
    const csv = `address,eth_amount,usd_value,rank\\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.2,3000,5`;
    const result = parseCsv(csv, {
      ...OPTS,
      sourceName: "wearekent_",
      label: "kent_unclaimed_airdrop_list",
      defaultLabelType: "airdrop_target",
      defaultChain: "ethereum",
    });
    expect(result.rows[0].evidence).toContain("eth=1.2");
    expect(result.rows[0].evidence).toContain("usd=3000");
    expect(result.rows[0].evidence).toContain("rank=5");
  });

  it("retourne warning si aucune adresse trouvée", () => {
    const csv = `name,amount\\nAlice,1\\nBob,2`;
    const result = parseCsv(csv, OPTS);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warn sur chains mixtes EVM + Solana", () => {
    const csv = `address\\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\\nBYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb`;
    const result = parseCsv(csv, OPTS);
    const hasChainWarn = result.warnings.some(w => w.includes("Chains mixtes"));
    expect(hasChainWarn).toBe(true);
  });
});

// ── JSON parser ─────────────────────────────────────────────────────────────────
describe("parseJson", () => {
  it("extrait adresses d'un tableau plat", () => {
    const json = JSON.stringify([
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    ]);
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(2);
  });

  it("extrait adresses imbriquées dans des objets", () => {
    const json = JSON.stringify({
      wallets: [{ addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }],
    });
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(1);
  });

  it("déduplique les adresses", () => {
    const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const json = JSON.stringify([addr, addr, addr]);
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(1);
  });
});

// ── Text parser ─────────────────────────────────────────────────────────────────
describe("parseText", () => {
  it("extrait adresses EVM d'un thread", () => {
    const text = `
      Attention scam détecté sur 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
      et aussi 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B — évitez ces wallets!
    `;
    const result = parseText(text, OPTS);
    expect(result.rows).toHaveLength(2);
  });

  it("retourne warning si aucune adresse dans le texte", () => {
    const result = parseText("Rien ici, juste du texte.", OPTS);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });
});

// ── Sheet URL converter ─────────────────────────────────────────────────────────
describe("toExportUrl", () => {
  it("convertit une URL /edit en export CSV", () => {
    const url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0";
    const exportUrl = toExportUrl(url);
    expect(exportUrl).toContain("/export?format=csv");
    expect(exportUrl).toContain("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms");
    expect(exportUrl).toContain("gid=0");
  });

  it("convertit une URL /pub", () => {
    const url = "https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=123456789";
    const exportUrl = toExportUrl(url);
    expect(exportUrl).toContain("gid=123456789");
  });

  it("lève une erreur pour une URL invalide", () => {
    expect(() => toExportUrl("https://example.com/not-a-sheet")).toThrow();
  });
});
'''

FILES["src/lib/intel-vault/__tests__/dedup.test.ts"] = '''\
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    addressLabel: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { upsertRows } from "../dedup";
import { prisma } from "@/lib/prisma";
import type { NormalizedRow } from "../types";

const ROW: NormalizedRow = {
  chain: "ethereum",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  labelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  confidence: "low",
  sourceName: "wearekent_",
  sourceUrl: "https://docs.google.com/spreadsheets/d/TEST",
  evidence: "eth=1.2, usd=3000",
  visibility: "internal_only",
  tosRisk: "low",
};

describe("upsertRows dedup logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée un nouveau label si inexistant", async () => {
    (prisma.addressLabel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.addressLabel.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new" });

    const result = await upsertRows([ROW], "batch-1");
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(prisma.addressLabel.create).toHaveBeenCalledOnce();
  });

  it("met à jour un label existant (merge evidence)", async () => {
    (prisma.addressLabel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ROW,
      id: "existing",
      evidence: "eth=1.0",
    });
    (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

    const result = await upsertRows([ROW], "batch-1");
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    const updateCall = (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // evidence doit contenir les deux parties
    expect(updateCall.data.evidence).toContain("eth=1.0");
    expect(updateCall.data.evidence).toContain("eth=1.2");
  });

  it("ne duplique pas l'evidence si identique", async () => {
    (prisma.addressLabel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ROW,
      id: "existing",
      evidence: "eth=1.2, usd=3000",
    });
    (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

    await upsertRows([ROW], "batch-1");
    const updateCall = (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Evidence ne doit pas être doublé
    const occ = (updateCall.data.evidence.match(/eth=1\.2/g) ?? []).length;
    expect(occ).toBe(1);
  });
});
'''

FILES["src/lib/intel-vault/__tests__/wearekent.test.ts"] = '''\
// Tests spécifiques au mapping wearekent_
import { describe, it, expect } from "vitest";
import { parseCsv } from "../parsers/csv";
import type { ParseOptions } from "../types";

// Simule le contenu CSV exporté du sheet wearekent
const WEAREKENT_CSV = `address,eth_amount,usd_value,rank
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.5,3200,1
0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B,0.8,1700,2
invalid_address,0.1,200,3
0x71C7656EC7ab88b098defB751B7401B5f6d8976F,2.0,4300,4`;

const KENT_OPTS: ParseOptions = {
  defaultChain: "ethereum",
  defaultLabelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  sourceName: "wearekent_",
  sourceUrl: "https://docs.google.com/spreadsheets/d/KENT_SHEET",
  visibility: "internal_only",
  confidence: "low",
};

describe("wearekent mapping", () => {
  it("mappe uniquement les adresses EVM valides", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    // 3 adresses valides sur 4 (invalid_address exclue)
    expect(result.rows).toHaveLength(3);
  });

  it("chain = ethereum pour toutes les lignes", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.chain).toBe("ethereum"));
  });

  it("labelType = airdrop_target", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.labelType).toBe("airdrop_target"));
  });

  it("label = kent_unclaimed_airdrop_list", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.label).toBe("kent_unclaimed_airdrop_list"));
  });

  it("confidence = low", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.confidence).toBe("low"));
  });

  it("sourceName = wearekent_", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.sourceName).toBe("wearekent_"));
  });

  it("evidence contient eth + usd + rank", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    const first = result.rows[0];
    expect(first.evidence).toContain("eth=1.5");
    expect(first.evidence).toContain("usd=3200");
    expect(first.evidence).toContain("rank=1");
  });

  it("visibility = internal_only (JAMAIS scam/drainer)", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => {
      expect(r.visibility).toBe("internal_only");
      expect(r.labelType).not.toBe("scam");
      expect(r.labelType).not.toBe("drainer");
      expect(r.labelType).not.toBe("phishing");
    });
  });
});
'''

def write_file(rel_path: str, content: str):
    ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))
    abs_path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if os.path.exists(abs_path):
        with open(abs_path, "r") as f:
            existing = f.read().strip()
        if existing == content.strip():
            print(f"✅ {rel_path} — déjà à jour, skip.")
            return
        print(f"⚠️  {rel_path} — existe déjà, écrasement.")
    with open(abs_path, "w") as f:
        f.write(content)
    print(f"✅ {rel_path} — écrit.")

def patch():
    for path, content in FILES.items():
        write_file(path, content)
    print("\n✅ Patch 05 terminé — Tests Vitest Intel Vault.")
    print("   Fichiers de test:")
    print("     address.test.ts (6 tests)")
    print("     parsers.test.ts (11 tests)")
    print("     dedup.test.ts   (3 tests)")
    print("     wearekent.test.ts (8 tests)")
    print("\n   Lance: pnpm test")

patch()
