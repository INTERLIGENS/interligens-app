// ─── RC-SPINE-00 — L'ÉCRIVAIN GOUVERNÉ : LE TÉMOIN ─────────────────────────
//
// Forme complète : contrôle d'absence, témoin POSITIF de présence, mutations
// discriminantes. Chaque cause de refus est atteinte par un cas NOMMÉ ; la
// liste des cas est confrontée au vocabulaire pour qu'une cause ajoutée sans
// témoin rougisse.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  decidePublicClaimContract,
  decideFoundation,
  decidePublicRelease,
  isDecidedFoundation,
  EXPLICIT_PUBLIC_DECISION,
  PUBLIC_CLAIM_CONTRACT_CAUSES,
  FOUNDATION_REFUSAL_CAUSES,
  RELEASE_REFUSAL_CAUSES,
  type FoundationRequest,
  type FoundationRefusalCause,
  type ReleaseRefusalCause,
  type Foundation,
  type ExplicitPublicationAuthority,
  type ClaimAssertionInput,
  type ExistingClaimInput,
} from "@/lib/casefile/governedWriter";
import { claimContentHash } from "@/lib/casefile/versioning";
import { projectForPublication, VINE_CASEFILE_REF, VINE_MINT } from "@/lib/casefile/publicProjection";
import { ProvenanceLostError, resolveProvenance, type CanonicalCaseFile, type PublicSource } from "@/lib/casefile/canonicalReader";

// ─── Fixtures : un fondement COMPLET et VALIDE ─────────────────────────────

const SHA = "a".repeat(64);
const DOSSIER = { ref: VINE_CASEFILE_REF, canonicalMint: VINE_MINT } as const;

const snapshot = (o: Partial<FoundationRequest["snapshots"][number]> = {}) => ({
  id: "snap-1",
  canonicalMint: VINE_MINT,
  sha256: SHA,
  sourceUrl: "https://x.com/exemple/status/1",
  observedAt: "2025-12-07T10:00:00.000Z",
  ...o,
});

const claim = (o: Partial<ClaimAssertionInput> & Record<string, unknown> = {}): ClaimAssertionInput => ({
  casefileRef: VINE_CASEFILE_REF,
  claimId: "C1",
  rowNature: "PRIMARY_OBSERVATION",
  title: "Coordinated posting",
  titleFr: "Publication coordonnée",
  claimDate: "2025-11-04",
  evidenceRefs: ["SRC-001"],
  ...o,
});

const request = (o: Partial<FoundationRequest> = {}): FoundationRequest => ({
  dossier: DOSSIER,
  snapshots: [snapshot()],
  sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "snap-1", sourceType: "screenshot", caption: "Fil 1/8" }],
  existingClaims: [],
  claim: claim(),
  ...o,
});

const founded = (r: FoundationRequest = request()): Foundation => {
  const d = decideFoundation(r);
  if (d.decision !== "FOUNDED") throw new Error(`attendu FOUNDED, reçu ${d.refusal.cause} @ ${d.refusal.at}`);
  return d.foundation;
};

const authority = (o: Partial<ExplicitPublicationAuthority> = {}): ExplicitPublicationAuthority => ({
  kind: EXPLICIT_PUBLIC_DECISION,
  decidedBy: "david",
  decidedAt: "2026-09-13T12:00:00Z",
  casefileRef: VINE_CASEFILE_REF,
  claimId: "C1",
  version: 1,
  ...o,
});

/** Une révision existante SCELLÉE, sous la normalisation de l'audit. */
const existing = (o: Partial<ExistingClaimInput> = {}): ExistingClaimInput => {
  const base = {
    casefileRef: VINE_CASEFILE_REF, claimId: "C1", version: 1,
    title: "Ancienne formulation", titleFr: null, description: null, descriptionFr: null,
    category: null, severity: null, status: null, claimDate: "2025-11-04",
    actors: [], threadUrl: null, evidenceRefs: ["SRC-001"],
    ...o,
  };
  const scellable = { ...base, actors: base.actors as string[], evidenceRefs: base.evidenceRefs as string[] };
  return { ...base, contentHash: o.contentHash === undefined ? claimContentHash(scellable) : o.contentHash };
};

// ═══ TÉMOIN POSITIF — un fondement complet PASSE ════════════════════════════

describe("RC-SPINE-00 — témoin positif : le fondement complet est FONDÉ, en ATTACHED", () => {
  it("rend FOUNDED, état ATTACHED littéral, version 1, sans supplantation", () => {
    const f = founded();
    expect(isDecidedFoundation(f)).toBe(true);
    expect(f.claimToInsert.state).toBe("ATTACHED");
    expect(f.claimToInsert.version).toBe(1);
    expect(f.claimToInsert.supersedes).toBeNull();
    expect(f.claimToInsert.rowNature).toBe("PRIMARY_OBSERVATION");
    expect(f.claimToInsert.evidenceRefs).toEqual(["SRC-001"]);
    expect(f.preconditions.latestExisting).toBeNull();
    expect(f.preconditions.sourceIdsExpectedAbsent).toEqual(["SRC-001"]);
    expect(f.preconditions.snapshots).toEqual([{ id: "snap-1", sha256: SHA }]);
  });

  it("la source est DÉRIVÉE du snapshot : sha256, sourceUrl, capturedAt, snapshotId viennent de lui", () => {
    const [s] = founded().sourcesToInsert;
    expect(s).toEqual({
      casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-001", sourceType: "screenshot", caption: "Fil 1/8",
      sha256: SHA, sourceUrl: "https://x.com/exemple/status/1",
      capturedAt: "2025-12-07T10:00:00.000Z", snapshotId: "snap-1",
    });
  });

  it("le sceau est calculé sous la normalisation MESURÉE de l'audit (tableaux, jamais null)", () => {
    const f = founded();
    const attendu = claimContentHash({
      claimId: "C1", title: "Coordinated posting", titleFr: "Publication coordonnée",
      description: null, descriptionFr: null, category: null, severity: null, status: null,
      claimDate: "2025-11-04", actors: [], threadUrl: null, evidenceRefs: ["SRC-001"],
    });
    expect(f.claimToInsert.contentHash).toBe(attendu);
    // Et PAS la forme « actors absent » — 0/16 sceaux réels y correspondent.
    const absent = claimContentHash({ claimId: "C1", title: "Coordinated posting", titleFr: "Publication coordonnée", claimDate: "2025-11-04", evidenceRefs: ["SRC-001"] });
    expect(f.claimToInsert.contentHash).not.toBe(absent);
  });

  it("une source EXISTANTE complète résout aussi, et n'est jamais réinsérée", () => {
    const f = founded(request({
      sources: [{ kind: "EXISTING", casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-EXT", sourceType: "thread", caption: null, capturedAt: "2025-12-07", sourceUrl: "https://x.com/e/2", sha256: SHA }],
      claim: claim({ evidenceRefs: ["SRC-EXT"] }),
    }));
    expect(f.sourcesToInsert).toEqual([]);
    expect(f.citedSources.map((s) => s.sourceId)).toEqual(["SRC-EXT"]);
  });

  it("le plan ne contient AUCUNE forme de modification d'une ligne existante", () => {
    const f = founded();
    expect(Object.keys(f).sort()).toEqual(["casefileRef", "citedSources", "claimToInsert", "preconditions", "sourcesToInsert"]);
  });
});

// ═══ PROPRIÉTÉ 2 — versionner, jamais écraser ═══════════════════════════════

describe("RC-SPINE-00 — propriété 2 : une correction produit une NOUVELLE version", () => {
  it("supplantation déclarée → version N+1, supersedes = (claimId, N), ancien sceau épinglé", () => {
    const ancienne = existing();
    const f = founded(request({ existingClaims: [ancienne], claim: claim({ title: "Nouvelle formulation", supersedesVersion: 1 }) }));
    expect(f.claimToInsert.version).toBe(2);
    expect(f.claimToInsert.supersedes).toEqual({ claimId: "C1", version: 1 });
    expect(f.claimToInsert.state).toBe("ATTACHED");
    expect(f.preconditions.latestExisting).toEqual({ claimId: "C1", version: 1, contentHash: ancienne.contentHash });
  });

  it("la dernière version est celle qui compte : v1 et v2 présentes → supplanter v2 donne v3", () => {
    const v1 = existing();
    const v2 = existing({ version: 2, title: "Deuxième" });
    const f = founded(request({ existingClaims: [v1, v2], claim: claim({ title: "Troisième", supersedesVersion: 2 }) }));
    expect(f.claimToInsert.version).toBe(3);
    expect(f.claimToInsert.supersedes).toEqual({ claimId: "C1", version: 2 });
  });

  it("une révision jamais scellée (contentHash null) se supplante quand même — l'absence n'est pas une accusation", () => {
    const f = founded(request({ existingClaims: [existing({ contentHash: null })], claim: claim({ title: "Corrigée", supersedesVersion: 1 }) }));
    expect(f.claimToInsert.version).toBe(2);
  });
});

// ═══ CONTRÔLE D'ABSENCE — chaque cause, un cas nommé ════════════════════════

type Cas = readonly [nom: string, request: unknown, cause: FoundationRefusalCause, at: string];

const REFUSES_FONDEMENT: readonly Cas[] = [
  // ── forme ──
  ["requête null", null, "MALFORMED_INPUT", "request"],
  ["dossier absent", { ...request(), dossier: undefined }, "MALFORMED_INPUT", "dossier"],
  ["dossier.ref vide", request({ dossier: { ref: "", canonicalMint: VINE_MINT } }), "MALFORMED_INPUT", "dossier.ref"],
  ["dossier.canonicalMint vide", request({ dossier: { ref: VINE_CASEFILE_REF, canonicalMint: " " } }), "MALFORMED_INPUT", "dossier.canonicalMint"],
  ["snapshots pas un tableau", { ...request(), snapshots: {} }, "MALFORMED_INPUT", "snapshots"],
  ["sources pas un tableau", { ...request(), sources: "SRC-001" }, "MALFORMED_INPUT", "sources"],
  ["existingClaims pas un tableau", { ...request(), existingClaims: null }, "MALFORMED_INPUT", "existingClaims"],
  ["claim absent", { ...request(), claim: undefined }, "MALFORMED_INPUT", "claim"],
  ["snapshot sans id", request({ snapshots: [snapshot({ id: "" })] }), "MALFORMED_INPUT", "snapshots[0]"],
  ["snapshot en double", request({ snapshots: [snapshot(), snapshot()] }), "MALFORMED_INPUT", "snapshots[snap-1]"],
  ["source sans sourceId", request({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "", snapshotId: "snap-1", sourceType: "screenshot" }] }), "MALFORMED_INPUT", "sources[0]"],
  ["sourceId en double", request({ sources: [...request().sources, ...request().sources] }), "MALFORMED_INPUT", "sources[SRC-001]"],
  ["source kind inconnu", { ...request(), sources: [{ kind: "GUESSED", sourceId: "SRC-001", sourceType: "screenshot" }] }, "MALFORMED_INPUT", "sources[SRC-001].kind"],
  ["source FROM_SNAPSHOT sans snapshotId", request({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "", sourceType: "screenshot" }] }), "MALFORMED_INPUT", "sources[SRC-001].snapshotId"],
  ["source EXISTING avec sha256 non textuel", request({ sources: [{ kind: "EXISTING", casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-001", sourceType: "thread", caption: null, capturedAt: "2025-12-07", sourceUrl: "https://x", sha256: 42 as unknown as string }] }), "MALFORMED_INPUT", "sources[SRC-001].provenance"],
  ["claimId vide", request({ claim: claim({ claimId: "" }) }), "MALFORMED_INPUT", "claim.claimId"],
  ["title vide", request({ claim: claim({ title: "  " }) }), "MALFORMED_INPUT", "claim.title"],
  ["description non textuelle", request({ claim: claim({ description: 7 as unknown as string }) }), "MALFORMED_INPUT", "claim.description"],
  ["claimDate hors forme YYYY-MM-DD", request({ claim: claim({ claimDate: "2025-11-04T00:00:00Z" }) }), "MALFORMED_INPUT", "claim.claimDate"],
  ["actors non tableau de chaînes", request({ claim: claim({ actors: ["a", 1] as unknown as string[] }) }), "MALFORMED_INPUT", "claim.actors"],
  ["natureBasis non objet", request({ claim: claim({ natureBasis: "x" as unknown as Record<string, unknown> }) }), "MALFORMED_INPUT", "claim.natureBasis"],
  ["supersedesVersion 0", request({ claim: claim({ supersedesVersion: 0 }) }), "MALFORMED_INPUT", "claim.supersedesVersion"],
  ["existingClaim sans version", request({ existingClaims: [{ ...existing(), version: undefined as unknown as number }] }), "MALFORMED_INPUT", "existingClaims[0]"],
  // ── mélange entre dossiers ──
  ["snapshot d'un autre mint", request({ snapshots: [snapshot({ canonicalMint: "AutreMint1111111111111111111111111111111111" })] }), "DOSSIER_MIX", "snapshots[snap-1].canonicalMint"],
  ["source EXISTING d'un autre dossier", request({ sources: [{ kind: "EXISTING", casefileRef: "IL-SHILL-BOTIFY-001", sourceId: "SRC-001", sourceType: "thread", caption: null, capturedAt: "2025-12-07", sourceUrl: "https://x", sha256: SHA }] }), "DOSSIER_MIX", "sources[SRC-001].casefileRef"],
  ["claim d'un autre dossier", request({ claim: claim({ casefileRef: "IL-SHILL-BOTIFY-001" }) }), "DOSSIER_MIX", "claim.casefileRef"],
  ["révision existante d'un autre dossier", request({ existingClaims: [existing({ casefileRef: "IL-SHILL-BOTIFY-001" })], claim: claim({ supersedesVersion: 1 }) }), "DOSSIER_MIX", "existingClaims[C1].casefileRef"],
  // ── snapshot inexistant ou non admissible ──
  ["snapshot inexistant", request({ snapshots: [] }), "SNAPSHOT_MISSING", "snap-1"],
  ["snapshot sans canonicalMint", request({ snapshots: [snapshot({ canonicalMint: null })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].canonicalMint"],
  ["snapshot sans sha256", request({ snapshots: [snapshot({ sha256: null })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].sha256"],
  ["snapshot sha256 vide", request({ snapshots: [snapshot({ sha256: "" })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].sha256"],
  ["snapshot sans sourceUrl", request({ snapshots: [snapshot({ sourceUrl: null })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].sourceUrl"],
  ["snapshot sans observedAt", request({ snapshots: [snapshot({ observedAt: null })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].observedAt"],
  ["snapshot observedAt illisible", request({ snapshots: [snapshot({ observedAt: "hier" })] }), "SNAPSHOT_NOT_ADMISSIBLE", "snapshots[snap-1].observedAt"],
  // ── source sans sha256 / sourceUrl / capturedAt ──
  ["source existante sans sha256", request({ sources: [{ kind: "EXISTING", casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-001", sourceType: "thread", caption: null, capturedAt: "2025-12-07", sourceUrl: "https://x", sha256: null }] }), "SOURCE_PROVENANCE_INCOMPLETE", "SRC-001.sha256"],
  ["source existante sans sourceUrl", request({ sources: [{ kind: "EXISTING", casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-001", sourceType: "thread", caption: null, capturedAt: "2025-12-07", sourceUrl: "", sha256: SHA }] }), "SOURCE_PROVENANCE_INCOMPLETE", "SRC-001.sourceUrl"],
  ["source existante sans capturedAt", request({ sources: [{ kind: "EXISTING", casefileRef: VINE_CASEFILE_REF, sourceId: "SRC-001", sourceType: "thread", caption: null, capturedAt: null, sourceUrl: "https://x", sha256: SHA }] }), "SOURCE_PROVENANCE_INCOMPLETE", "SRC-001.capturedAt"],
  // ── claim UNCLASSIFIED ──
  ["rowNature UNCLASSIFIED", request({ claim: claim({ rowNature: "UNCLASSIFIED" }) }), "CLAIM_UNCLASSIFIED", "rowNature"],
  ["rowNature null", request({ claim: claim({ rowNature: null }) }), "CLAIM_UNCLASSIFIED", "rowNature"],
  ["rowNature absente", request({ claim: claim({ rowNature: undefined }) }), "CLAIM_UNCLASSIFIED", "rowNature"],
  ["rowNature en minuscules", request({ claim: claim({ rowNature: "primary_observation" }) }), "CLAIM_UNCLASSIFIED", "rowNature"],
  ["rowNature inconnue", request({ claim: claim({ rowNature: "FACT" }) }), "CLAIM_UNCLASSIFIED", "rowNature"],
  // ── evidenceRefs = [] ──
  ["evidenceRefs vide", request({ claim: claim({ evidenceRefs: [] }) }), "EVIDENCE_REFS_EMPTY", "evidenceRefs"],
  ["evidenceRefs absent", request({ claim: claim({ evidenceRefs: undefined as unknown as string[] }) }), "EVIDENCE_REFS_EMPTY", "evidenceRefs"],
  ["evidenceRefs non tableau", request({ claim: claim({ evidenceRefs: "SRC-001" as unknown as string[] }) }), "EVIDENCE_REFS_EMPTY", "evidenceRefs"],
  // ── ref non résolue ──
  ["ref inconnue du registre", request({ claim: claim({ evidenceRefs: ["SRC-001", "SRC-999"] }) }), "EVIDENCE_REF_UNRESOLVED", "SRC-999"],
  ["ref en prose", request({ claim: claim({ evidenceRefs: ["screenshots TBC"] }) }), "EVIDENCE_REF_UNRESOLVED", "screenshots TBC"],
  ["ref non textuelle", request({ claim: claim({ evidenceRefs: [1] as unknown as string[] }) }), "EVIDENCE_REF_UNRESOLVED", "evidenceRefs[0]"],
  // ── ESTIMATE auditable ──
  ["ESTIMATE sans méthode ni basis", request({ claim: claim({ rowNature: "ESTIMATE" }) }), "ESTIMATE_NOT_AUDITABLE", "claim.methodRef"],
  ["ESTIMATE avec basis vide", request({ claim: claim({ rowNature: "ESTIMATE", natureBasis: {} }) }), "ESTIMATE_NOT_AUDITABLE", "claim.methodRef"],
  // ── propriété 1 : publier d'un geste ──
  ["state PUBLIC dans la charge", request({ claim: claim({ state: "PUBLIC" }) }), "PUBLICATION_IN_FOUNDATION", "claim.state"],
  ["state ATTACHED dans la charge (même la bonne valeur)", request({ claim: claim({ state: "ATTACHED" }) }), "PUBLICATION_IN_FOUNDATION", "claim.state"],
  ["isPublic true dans la charge", request({ claim: claim({ isPublic: true }) }), "PUBLICATION_IN_FOUNDATION", "claim.isPublic"],
  ["exclusionReason dans la charge", request({ claim: claim({ exclusionReason: null }) }), "PUBLICATION_IN_FOUNDATION", "claim.exclusionReason"],
  ["publishStatus dans la charge", request({ claim: claim({ publishStatus: "published" }) }), "PUBLICATION_IN_FOUNDATION", "claim.publishStatus"],
  // ── versioning fourni par l'appelant ──
  ["version dans la charge", request({ claim: claim({ version: 1 }) }), "VERSIONING_SUPPLIED", "claim.version"],
  ["supersedes (id de ligne) dans la charge", request({ claim: claim({ supersedes: "uuid" }) }), "VERSIONING_SUPPLIED", "claim.supersedes"],
  ["contentHash dans la charge", request({ claim: claim({ contentHash: SHA }) }), "VERSIONING_SUPPLIED", "claim.contentHash"],
  ["id dans la charge", request({ claim: claim({ id: "uuid" }) }), "VERSIONING_SUPPLIED", "claim.id"],
  // ── propriété 2 : modification silencieuse ──
  ["claimId existant, aucune supplantation déclarée", request({ existingClaims: [existing()], claim: claim({ title: "Modifiée" }) }), "SILENT_REWRITE", "C1"],
  ["supplantation d'une version périmée", request({ existingClaims: [existing(), existing({ version: 2, title: "v2" })], claim: claim({ title: "v3", supersedesVersion: 1 }) }), "STALE_SUPERSEDE", "C1"],
  ["supplantation déclarée sans claim existant", request({ claim: claim({ supersedesVersion: 1 }) }), "SUPERSEDES_NOTHING", "C1"],
  ["dernière version au sceau cassé", request({ existingClaims: [existing({ contentHash: "0".repeat(64) })], claim: claim({ title: "Modifiée", supersedesVersion: 1 }) }), "SEAL_BROKEN", "C1"],
  ["supplantation au contenu identique", request({ existingClaims: [existing({ title: "Coordinated posting", titleFr: "Publication coordonnée" })], claim: claim({ supersedesVersion: 1 }) }), "CONTENT_UNCHANGED", "C1"],
];

describe("RC-SPINE-00 — fail-closed : chaque refus est nommé, à un emplacement nommé", () => {
  for (const [nom, r, cause, at] of REFUSES_FONDEMENT) {
    it(`${nom} → REFUSED / ${cause} @ ${at}`, () => {
      const d = decideFoundation(r as FoundationRequest);
      expect(d.decision).toBe("REFUSED");
      if (d.decision !== "REFUSED") throw new Error("inatteignable");
      expect(d.refusal).toEqual({ cause, at });
    });
  }

  it("toute cause du vocabulaire de fondement est atteinte par au moins un cas", () => {
    const atteintes = new Set(REFUSES_FONDEMENT.map(([, , c]) => c));
    for (const c of FOUNDATION_REFUSAL_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });

  it("un refus ne porte que deux clefs : cause et at — jamais un contenu", () => {
    for (const [, r] of REFUSES_FONDEMENT) {
      const d = decideFoundation(r as FoundationRequest);
      if (d.decision !== "REFUSED") continue;
      expect(Object.keys(d.refusal).sort()).toEqual(["at", "cause"]);
      expect(d.refusal.at).not.toContain("Coordinated");
    }
  });
});

// ═══ PROPRIÉTÉ 1 — créer le fondement ≠ publier ═════════════════════════════

describe("RC-SPINE-00 — propriété 1 : la libération est une SECONDE décision, sous autorité explicite", () => {
  it("témoin positif : fondement décidé + autorité explicite → RELEASABLE, cible exacte", () => {
    const f = founded();
    const d = decidePublicRelease(f, authority());
    expect(d.decision).toBe("RELEASABLE");
    if (d.decision !== "RELEASABLE") throw new Error("inatteignable");
    expect(d.release.target).toEqual({ casefileRef: VINE_CASEFILE_REF, claimId: "C1", version: 1, expectedContentHash: f.claimToInsert.contentHash });
    expect(d.release.authority.kind).toBe(EXPLICIT_PUBLIC_DECISION);
    expect(d.release.authority.decidedBy).toBe("david");
  });

  it("le TYPE refuse un champ de publication dans la charge de fondement", () => {
    // @ts-expect-error — `state` n'existe pas sur ClaimAssertionInput : un appelant ne peut pas l'écrire.
    const c: ClaimAssertionInput = { casefileRef: VINE_CASEFILE_REF, claimId: "C1", rowNature: "PRIMARY_OBSERVATION", title: "t", evidenceRefs: ["SRC-001"], state: "PUBLIC" };
    expect(decideFoundation(request({ claim: c })).decision).toBe("REFUSED");
  });

  it("le TYPE refuse un fondement construit à la main", () => {
    const f = founded();
    // @ts-expect-error — `Foundation` est nominal : une copie structurelle n'a pas la marque.
    const copie: Foundation = { casefileRef: f.casefileRef, sourcesToInsert: f.sourcesToInsert, claimToInsert: f.claimToInsert, citedSources: f.citedSources, preconditions: f.preconditions };
    expect(decidePublicRelease(copie, authority()).decision).toBe("REFUSED");
  });

  const REFUSES_LIBERATION: ReadonlyArray<readonly [string, () => Foundation, unknown, ReleaseRefusalCause, string]> = [
    ["fondement copié structurellement", () => ({ ...founded() }) as Foundation, authority(), "NOT_A_FOUNDATION", "foundation"],
    ["fondement null", () => null as unknown as Foundation, authority(), "NOT_A_FOUNDATION", "foundation"],
    ["autorité absente", founded, undefined, "NO_EXPLICIT_AUTHORITY", "authority"],
    ["autorité booléenne", founded, true, "NO_EXPLICIT_AUTHORITY", "authority"],
    ["autorité sans kind", founded, { decidedBy: "david", decidedAt: "2026-09-13T12:00:00Z" }, "NO_EXPLICIT_AUTHORITY", "authority.kind"],
    ["kind approchant", founded, authority({ kind: "explicit_public_decision" as never }), "NO_EXPLICIT_AUTHORITY", "authority.kind"],
    ["decidedBy vide", founded, authority({ decidedBy: "" }), "NO_EXPLICIT_AUTHORITY", "authority.decidedBy"],
    ["decidedAt sans Z", founded, authority({ decidedAt: "2026-09-13T12:00:00" }), "NO_EXPLICIT_AUTHORITY", "authority.decidedAt"],
    ["decidedAt heure locale", founded, authority({ decidedAt: "2026-09-13T12:00:00+02:00" }), "NO_EXPLICIT_AUTHORITY", "authority.decidedAt"],
    ["autorité sur un autre dossier", founded, authority({ casefileRef: "IL-SHILL-BOTIFY-001" }), "AUTHORITY_TARGET_MISMATCH", "authority.casefileRef"],
    ["autorité sur un autre claim", founded, authority({ claimId: "C2" }), "AUTHORITY_TARGET_MISMATCH", "authority.claimId"],
    ["autorité sans version", founded, authority({ version: undefined as unknown as number }), "AUTHORITY_TARGET_MISMATCH", "authority.version"],
    ["autorité sur la version suivante", founded, authority({ version: 2 }), "AUTHORITY_TARGET_MISMATCH", "authority.version"],
  ];

  for (const [nom, f, a, cause, at] of REFUSES_LIBERATION) {
    it(`${nom} → REFUSED / ${cause} @ ${at}`, () => {
      const d = decidePublicRelease(f(), a as ExplicitPublicationAuthority);
      expect(d.decision).toBe("REFUSED");
      if (d.decision !== "REFUSED") throw new Error("inatteignable");
      expect(d.refusal).toEqual({ cause, at });
    });
  }

  // La libération ne fait pas confiance au plan : elle re-dérive le contrat.
  // Chaque cause du contrat partagé est atteinte ICI aussi.
  const ALTERES: ReadonlyArray<readonly [string, (f: Foundation) => void, ReleaseRefusalCause, string]> = [
    ["rowNature altérée après décision", (f) => { (f.claimToInsert as unknown as { rowNature: unknown }).rowNature = "UNCLASSIFIED"; }, "CLAIM_UNCLASSIFIED", "rowNature"],
    ["evidenceRefs vidées après décision", (f) => { (f.claimToInsert as unknown as { evidenceRefs: string[] }).evidenceRefs = []; }, "EVIDENCE_REFS_EMPTY", "evidenceRefs"],
    ["pièce citée retirée après décision", (f) => { (f.citedSources as PublicSource[]).length = 0; }, "EVIDENCE_REF_UNRESOLVED", "SRC-001"],
    ["sha256 de la pièce citée effacé après décision", (f) => { (f.citedSources[0] as { sha256: string | null }).sha256 = null; }, "SOURCE_PROVENANCE_INCOMPLETE", "SRC-001.sha256"],
  ];
  for (const [nom, alterer, cause, at] of ALTERES) {
    it(`${nom} → REFUSED / ${cause} @ ${at}`, () => {
      const f = founded();
      alterer(f);
      const d = decidePublicRelease(f, authority());
      expect(d.decision).toBe("REFUSED");
      if (d.decision !== "REFUSED") throw new Error("inatteignable");
      expect(d.refusal).toEqual({ cause, at });
    });
  }

  it("toute cause du vocabulaire de libération est atteinte par au moins un cas", () => {
    const atteintes = new Set<string>([...REFUSES_LIBERATION.map(([, , , c]) => c), ...ALTERES.map(([, , c]) => c)]);
    for (const c of RELEASE_REFUSAL_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });
});

// ═══ LA MÊME PROPRIÉTÉ MORD AUX TROIS ENDROITS ══════════════════════════════

describe("RC-SPINE-00 — retirer les evidenceRefs empêche le fondement, la libération ET la projection", () => {
  /** Le dossier canonique tel que le producteur le lirait après exécution du plan. */
  const dossierApresPlan = (f: Foundation, state: "ATTACHED" | "PUBLIC", evidenceRefs: readonly string[]): CanonicalCaseFile => {
    const sources: PublicSource[] = f.sourcesToInsert.map((s) => ({
      sourceId: s.sourceId, sourceType: s.sourceType, caption: s.caption,
      capturedAt: s.capturedAt.slice(0, 10), sourceUrl: s.sourceUrl, sha256: s.sha256,
    }));
    const registre = new Map(sources.map((s) => [s.sourceId, s]));
    const c = f.claimToInsert;
    return {
      ref: f.casefileRef, codename: "VINE", ticker: "$VINE", title: "t", tigerScore: null, verdict: "AVOID",
      publishStatus: "published",
      claims: [{
        claimId: c.claimId, title: c.title, titleFr: c.titleFr, description: c.description, descriptionFr: c.descriptionFr,
        category: c.category, severity: c.severity, status: c.status, claimDate: c.claimDate, state,
        rowNature: c.rowNature, evidenceRefs,
        provenance: resolveProvenance(c.threadUrl, evidenceRefs, registre),
      }],
      sources, keyWallets: [],
    };
  };

  it("témoin positif : le claim fondé, libéré puis projeté est RENDU avec sa pièce", () => {
    const f = founded();
    expect(decidePublicRelease(f, authority()).decision).toBe("RELEASABLE");
    const p = projectForPublication(dossierApresPlan(f, "PUBLIC", f.claimToInsert.evidenceRefs), "test");
    expect(p.claims.map((c) => c.claimId)).toEqual(["C1"]);
    expect(p.sources.map((s) => s.sourceId)).toEqual(["SRC-001"]);
    expect(p.withheld).toEqual([]);
  });

  it("mutation : evidenceRefs = [] → le fondement refuse, la libération refuse, la projection lève", () => {
    // 1 · fondement
    const d = decideFoundation(request({ claim: claim({ evidenceRefs: [] }) }));
    expect(d).toEqual({ decision: "REFUSED", refusal: { cause: "EVIDENCE_REFS_EMPTY", at: "evidenceRefs" } });

    // 2 · libération, sur un fondement altéré après coup
    const f = founded();
    (f.claimToInsert as unknown as { evidenceRefs: string[] }).evidenceRefs = [];
    expect(decidePublicRelease(f, authority())).toEqual({ decision: "REFUSED", refusal: { cause: "EVIDENCE_REFS_EMPTY", at: "evidenceRefs" } });

    // 3 · projection, sur le dossier tel que le producteur le lirait
    expect(() => projectForPublication(dossierApresPlan(founded(), "PUBLIC", []), "test")).toThrow(ProvenanceLostError);
  });

  it("le fondement seul ne publie rien : projeté en ATTACHED, le claim est retenu, champ `state`", () => {
    const p = projectForPublication(dossierApresPlan(founded(), "ATTACHED", ["SRC-001"]), "test");
    expect(p.claims).toEqual([]);
    expect(p.withheld).toEqual([{ excluded: true, reason: "EXCLUDED_FROM_PUBLICATION", field: "state", count: 1 }]);
  });
});

// ═══ LA PRIMITIVE PARTAGÉE, SEULE ═══════════════════════════════════════════

describe("RC-SPINE-00 — le contrat public est une primitive à part, consommée deux fois", () => {
  const registre = new Map<string, PublicSource>([
    ["SRC-001", { sourceId: "SRC-001", sourceType: "screenshot", caption: null, capturedAt: "2025-12-07", sourceUrl: "https://x", sha256: SHA }],
    ["SRC-NUE", { sourceId: "SRC-NUE", sourceType: "screenshot", caption: null, capturedAt: null, sourceUrl: null, sha256: null }],
  ]);

  it("MET : nature classifiée, ≥ 1 ref, chaque ref résolue vers une pièce complète", () => {
    const v = decidePublicClaimContract({ rowNature: "INFERENCE", evidenceRefs: ["SRC-001"] }, registre);
    expect(v.verdict).toBe("MET");
    if (v.verdict !== "MET") throw new Error("inatteignable");
    expect(v.cited.map((s) => s.sourceId)).toEqual(["SRC-001"]);
  });

  it("threadUrl n'est PAS un substitut : sans ref, UNMET même avec un fil cité", () => {
    const v = decidePublicClaimContract({ rowNature: "INFERENCE", evidenceRefs: [], threadUrl: "https://x/9" } as never, registre);
    expect(v).toEqual({ verdict: "UNMET", refusal: { cause: "EVIDENCE_REFS_EMPTY", at: "evidenceRefs" } });
  });

  it("une pièce nue mord sur le PREMIER champ manquant, par nom", () => {
    const v = decidePublicClaimContract({ rowNature: "INFERENCE", evidenceRefs: ["SRC-NUE"] }, registre);
    expect(v).toEqual({ verdict: "UNMET", refusal: { cause: "SOURCE_PROVENANCE_INCOMPLETE", at: "SRC-NUE.sha256" } });
  });

  it("les deux décisions consomment la primitive, dans le code", () => {
    const code = readFileSync("src/lib/casefile/governedWriter.ts", "utf8")
      .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code.match(/decidePublicClaimContract\(/g)?.length).toBe(3); // 1 définition + 2 consommations
    expect(code).toContain("isPubliableSource(");
    expect(PUBLIC_CLAIM_CONTRACT_CAUSES.every((c) => (FOUNDATION_REFUSAL_CAUSES as readonly string[]).includes(c))).toBe(true);
    expect(PUBLIC_CLAIM_CONTRACT_CAUSES.every((c) => (RELEASE_REFUSAL_CAUSES as readonly string[]).includes(c))).toBe(true);
  });

  it("la décision est pure : aucun accès base dans le module", () => {
    const code = readFileSync("src/lib/casefile/governedWriter.ts", "utf8")
      .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    for (const interdit of ["@/lib/prisma", "$queryRaw", "$executeRaw", "$transaction", "prisma."]) {
      expect(code, interdit).not.toContain(interdit);
    }
  });
});
