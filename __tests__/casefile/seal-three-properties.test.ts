// ─── BUILD 9 — LES TROIS PROPRIÉTÉS DU SCELLEMENT ──────────────────────────
//
//   1. contenu intact                → validation verte
//   2. mutation contrôlée            → CONTENT_MUTATED
//   3. aucune correction légitime ne réécrit SILENCIEUSEMENT une version scellée
//
// Les deux premières se démontrent sur l'audit, la troisième sur le garde
// d'écriture. La distinction n'est pas cosmétique : l'audit CONSTATE après
// coup, le garde REFUSE avant. Une réécriture silencieuse se remarque
// d'autant moins qu'elle est ancienne.

import { describe, it, expect } from "vitest";
import {
  canonicalSealMaterial,
  claimContentHash,
  auditClaims,
  summarizeFindings,
  type AuditableClaim,
  type SealableClaim,
} from "@/lib/casefile/versioning";
import {
  assertNoSilentRewrite,
  isSealIntact,
  SilentRewriteError,
  BrokenSealError,
  type SealedRevision,
} from "@/lib/casefile/sealGuard";

const sceau = (c: SealableClaim): string => claimContentHash(canonicalSealMaterial(c));

const CONTENU: SealableClaim = {
  claimId: "C11",
  title: "Single-operator sybil network",
  titleFr: null,
  description: "Un financeur commun pour les cinq wallets acheteurs.",
  descriptionFr: null,
  category: "onchain",
  severity: "CRITICAL",
  status: "CONFIRMED",
  claimDate: "2025-01-22",
  actors: [],
  threadUrl: "https://x.com/exemple/status/1",
  evidenceRefs: ["SRC-001"],
};

const scelle = (o: Partial<SealedRevision> = {}): SealedRevision => ({
  ...CONTENU,
  version: 1,
  contentHash: sceau(CONTENU),
  ...o,
});

const REGISTRE = new Set(["SRC-001"]);

// ═══ Propriété 1 — contenu intact ════════════════════════════════════════

describe("PROPRIÉTÉ 1 — un contenu intact valide", () => {
  it("le sceau tient", () => {
    expect(isSealIntact(scelle())).toBe(true);
  });

  it("l'audit ne produit AUCUN constat", () => {
    const constats = auditClaims([scelle() as AuditableClaim], REGISTRE);
    expect(constats).toEqual([]);
    expect(summarizeFindings(constats).CONTENT_MUTATED).toBe(0);
  });

  it("une écriture qui ne touche pas au fond passe", () => {
    // Promouvoir, exclure, réindexer : rien de tout cela n'est du contenu.
    expect(() => assertNoSilentRewrite(scelle(), scelle())).not.toThrow();
  });
});

// ═══ Propriété 2 — mutation contrôlée ════════════════════════════════════

describe("PROPRIÉTÉ 2 — une mutation sous le sceau est DÉTECTÉE", () => {
  const mute = scelle({ description: "Texte réécrit après scellement." });

  it("le sceau ne tient plus", () => {
    expect(isSealIntact(mute)).toBe(false);
  });

  it("l'audit rend CONTENT_MUTATED, et rien d'autre", () => {
    const constats = auditClaims([mute as AuditableClaim], REGISTRE);
    expect(constats.map((c) => c.kind)).toEqual(["CONTENT_MUTATED"]);
    expect(constats[0].field).toBe("contentHash");
  });

  it("le constat nomme le claim et le champ — jamais le texte réécrit", () => {
    const constats = auditClaims([mute as AuditableClaim], REGISTRE);
    expect(JSON.stringify(constats)).not.toContain("réécrit");
  });

  it("un sceau ABSENT reste UNSEALED — l'absence n'accuse pas", () => {
    const constats = auditClaims([scelle({ contentHash: null }) as AuditableClaim], REGISTRE);
    expect(constats.map((c) => c.kind)).toEqual(["UNSEALED"]);
  });
});

// ═══ Propriété 3 — aucune réécriture silencieuse ═════════════════════════

describe("PROPRIÉTÉ 3 — une correction supplante, elle ne réécrit pas", () => {
  const corrige: SealableClaim = {
    ...CONTENU,
    description: "Reformulation sans notation sur cent.",
  };

  it("MUTANT — corriger SANS incrémenter la version est REFUSÉ", () => {
    expect(() =>
      assertNoSilentRewrite(scelle(), { ...corrige, version: 1 }),
    ).toThrow(SilentRewriteError);
  });

  it("corriger EN supplantant est autorisé", () => {
    expect(() =>
      assertNoSilentRewrite(scelle(), { ...corrige, version: 2 }),
    ).not.toThrow();
  });

  it("une version qui RECULE est refusée aussi", () => {
    // Sinon il suffirait de renuméroter pour contourner le garde.
    expect(() =>
      assertNoSilentRewrite(scelle({ version: 3 }), { ...corrige, version: 2 }),
    ).toThrow(SilentRewriteError);
  });

  it("écrire par-dessus un sceau DÉJÀ cassé est refusé", () => {
    // Autoriser l'écriture effacerait la trace de la première modification.
    expect(() =>
      assertNoSilentRewrite(
        scelle({ description: "déjà modifié en place" }),
        { ...corrige, version: 2 },
      ),
    ).toThrow(BrokenSealError);
  });

  // Le rendu SQL de supplantation (`renderSupersedeSql`) a été retiré en
  // SPINE-00 · B : il hachait la charge brute sans normaliser, 0/16 sceaux
  // persistés lui correspondaient. La supplantation passe par l'écrivain
  // gouverné — témoin : rc-spine-00-ecrivain-gouverne.test.ts, propriété 2 ;
  // contrôle d'absence : spine-00-b-sceau-canonique.test.ts.

  it("après supplantation, l'audit ne voit ni mutation ni trou", () => {
    const v1 = scelle() as AuditableClaim;
    const v2 = {
      ...corrige,
      version: 2,
      contentHash: sceau(corrige),
    } as AuditableClaim;
    const r = summarizeFindings(auditClaims([v1, v2], REGISTRE));
    expect(r.CONTENT_MUTATED).toBe(0);
    expect(r.VERSION_GAP).toBe(0);
    expect(r.UNSEALED).toBe(0);
  });
});
