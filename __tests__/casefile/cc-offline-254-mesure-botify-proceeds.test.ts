// ─── CC-OFFLINE-254 · BOTIFY-MEASURE-0 — HUIT MUTANTS, PAS QUARANTE ────────
//
// ██  DATA EXISTS. AUTHORITY IS MISSING.                                    ██
//
// ⚠️ LE COUPLE DÉCISIF est D + E : ensemble, ils démontrent que la frontière de
// consommation est RÉELLE et pas DÉCLARATIVE. Muter un champ USD ne change pas
// le digest ; muter un champ consommé le change. Séparés, ni l'un ni l'autre ne
// prouve rien.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  composerMesure,
  confronterRelecture,
  precisionObservee,
  CHAMPS_CONSOMMES,
  CHAMPS_NON_CONSOMMES,
  DECLARANT,
  INSTRUMENT_NAME,
  INSTRUMENT_VERSION,
  type EvenementMesure,
} from "@/scripts/casefile/mesure-botify-proceeds";
import { serialiserCanonique } from "@/scripts/casefile/mesure-vine-attribution";
import { validerQualification } from "@/lib/casefile/journalWriter";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

const T = "2026-09-16T17:00:00.000Z";
const CODE = "c".repeat(64);

const ev = (o: Partial<EvenementMesure> = {}): EvenementMesure => ({
  tokenAddress: BOTIFY_MINT,
  eventType: "dex_sell",
  walletAddress: "Wa11etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  actorReference: "unHandle",
  txHash: "tx-0001",
  chain: "SOL",
  tokenSymbol: "BOTIFY",
  caseTag: "BOTIFY",
  ambiguous: false,
  eventDate: "2026-04-14T10:11:12.000Z",
  amountTokens: 1000,
  ...o,
});

/** Le corpus nominal : deux types, deux portefeuilles, deux identifiants. */
const CORPUS: EvenementMesure[] = [
  ev(),
  ev({ txHash: "tx-0002", walletAddress: "Wa11etBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", actorReference: "autreHandle", amountTokens: 2500 }),
  ev({ txHash: "tx-0003", eventType: "cex_deposit", amountTokens: null, eventDate: "2026-04-15T00:00:00.000Z" }),
];

const digest = (evts: readonly EvenementMesure[], t = T, code = CODE, id?: { name: string; version: string }) =>
  createHash("sha256").update(serialiserCanonique(composerMesure(evts, t, code, id))).digest("hex");

// ═══ A · LA MESURE NOMINALE, DÉTERMINISTE ═══════════════════════════════════

describe("A · MUTANT — mesure nominale déterministe", () => {
  it("même corpus + même instrument + même observedAt ⇒ MÊMES octets", () => {
    expect(serialiserCanonique(composerMesure(CORPUS, T, CODE)))
      .toEqual(serialiserCanonique(composerMesure(CORPUS, T, CODE)));
  });

  it("l'ORDRE d'arrivée des lignes ne change pas les octets", () => {
    expect(digest([...CORPUS].reverse())).toBe(digest(CORPUS));
  });

  it("les cardinalités rendues sont celles du corpus, et rien de plus", () => {
    const m = composerMesure(CORPUS, T, CODE);
    const i = m.input as Record<string, unknown>;
    expect(i.recordedEvents).toBe(3);
    expect(i.distinctTransactionHashes).toBe(3);
    expect(i.distinctWalletAddresses).toBe(2);
    expect(i.distinctRecordedActorReferences).toBe(2);
    expect(i.flaggedAmbiguous).toBe(0);
    expect(m.result).toBe("ESTABLISHED");
  });

  it("l'agrégat natif est SOMMÉ DANS un type, jamais ENTRE les types", () => {
    const parType = (composerMesure(CORPUS, T, CODE).input as Record<string, Record<string, Record<string, unknown>>>).byEventType;
    expect(parType.dex_sell.nativeTokenAmountSum).toBe(3500);
    // `cex_deposit` ne porte aucun montant : on ne fabrique pas un zéro.
    expect(parType.cex_deposit.nativeTokenAmountSum).toBeNull();
    expect(parType.cex_deposit.nativeTokenAmountAbsent).toBe(1);
    // ⛔ Et AUCUN total inter-types n'existe dans la sortie.
    const plat = JSON.stringify(composerMesure(CORPUS, T, CODE));
    expect(plat).not.toMatch(/totalTokens|grandTotal|allEventsSum/);
  });

  it("les bornes expriment la PRÉCISION CAPTURÉE, jamais une précision reconstruite", () => {
    const b = (composerMesure(CORPUS, T, CODE).input as Record<string, Record<string, unknown>>).observedDateBounds;
    expect(b.earliest).toBe("2026-04-14T10:11:12.000Z");
    expect(b.latest).toBe("2026-04-15T00:00:00.000Z");
    expect(b.capturedPrecision).toEqual({ DAY: 1, SECOND: 2 });
    expect(precisionObservee("2026-04-15T00:00:00.000Z")).toBe("DAY");
    expect(precisionObservee("2026-04-14T10:11:12.000Z")).toBe("SECOND");
  });
});

// ═══ B · LE CORPUS CHANGE ⇒ LE DIGEST CHANGE ════════════════════════════════

describe("B · MUTANT — mutation du corpus ⇒ digest CHANGE", () => {
  it("un événement de plus change le digest", () => {
    expect(digest([...CORPUS, ev({ txHash: "tx-0004" })])).not.toBe(digest(CORPUS));
  });

  it("un événement de moins change le digest", () => {
    expect(digest(CORPUS.slice(0, 2))).not.toBe(digest(CORPUS));
  });

  it("un portefeuille différent change le digest", () => {
    const mute = [...CORPUS];
    mute[0] = ev({ walletAddress: "Wa11etZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" });
    expect(digest(mute)).not.toBe(digest(CORPUS));
  });
});

// ═══ C · LA BORNE DU MINT ═══════════════════════════════════════════════════

describe("C · MUTANT — un événement HORS mint BOTIFY n'entre pas dans la mesure", () => {
  it("un autre mint est EXCLU, et le digest est inchangé", () => {
    const etranger = ev({ txHash: "tx-etranger", tokenAddress: "So11111111111111111111111111111111111111112" });
    expect(digest([...CORPUS, etranger])).toBe(digest(CORPUS));
    expect((composerMesure([...CORPUS, etranger], T, CODE).input as Record<string, number>).recordedEvents).toBe(3);
  });

  it("`tokenAddress` NULL est EXCLU — la borne n'est pas « ce qui reste »", () => {
    expect(digest([...CORPUS, ev({ txHash: "tx-nul", tokenAddress: null })])).toBe(digest(CORPUS));
  });

  it("la CLÉ DE ROUTE SYNTHÉTIQUE à 43 caractères n'est PAS le mint et n'entre pas", () => {
    // Elle n'existe dans aucune ligne de la base ; si elle apparaissait, elle
    // serait refusée ici aussi. Aucune résolution heuristique d'un second mint.
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).not.toBe(BOTIFY_MINT);
    expect(digest([...CORPUS, ev({ txHash: "tx-synth", tokenAddress: BOTIFY_SYNTHETIC_ROUTE_KEY })])).toBe(digest(CORPUS));
  });
});

// ═══ D + E · LE COUPLE DÉCISIF ══════════════════════════════════════════════
//
// La frontière de consommation est-elle RÉELLE, ou seulement déclarée ?

describe("D · MUTANT — muter les champs USD / pricing ⇒ digest INCHANGÉ", () => {
  it("les six champs monétaires n'atteignent même pas la forme consommée", () => {
    // Ils ne sont pas « ignorés plus tard » : ils n'existent pas dans le type.
    const nominal = digest(CORPUS);
    const avecUsd = CORPUS.map((e) => ({
      ...e,
      amountUsd: 999_999,
      priceUsdAtTime: 42,
      pricingSource: "helius_sol_estimate_200usd",
      amountUsdNature: "ESTIMATE",
      amountUsdBasis: { anything: true },
      amountUsdMethodRef: "peu importe",
    })) as unknown as EvenementMesure[];
    expect(digest(avecUsd)).toBe(nominal);
  });

  it("AUCUNE valeur monétaire n'apparaît dans l'objet de mesure", () => {
    const rendu = JSON.stringify(composerMesure(CORPUS, T, CODE));
    for (const mot of ["amountUsd\":", "priceUsdAtTime\":", "usdTotal", "USD_TOTAL", "$"]) {
      expect(rendu, mot).not.toContain(mot);
    }
    // Les champs sont NOMMÉS comme non consommés — décrits, jamais consommés.
    for (const champ of CHAMPS_NON_CONSOMMES) expect(rendu).toContain(champ);
    expect(rendu).toContain("A STORED ESTIMATE IS NOT A MEASURED PRICE AUTHORITY");
  });
});

describe("E · MUTANT — muter un champ RÉELLEMENT consommé ⇒ digest CHANGE", () => {
  it("le TYPE D'ÉVÉNEMENT est consommé", () => {
    const mute = [...CORPUS];
    mute[0] = ev({ eventType: "cex_deposit" });
    expect(digest(mute)).not.toBe(digest(CORPUS));
  });

  it("le MONTANT NATIF est consommé", () => {
    const mute = [...CORPUS];
    mute[0] = ev({ amountTokens: 1001 });
    expect(digest(mute)).not.toBe(digest(CORPUS));
  });

  it("l'HORODATAGE observé est consommé — PAR SES BORNES ET SA PRÉCISION", () => {
    // ⚠️ MESURÉ, PAS SUPPOSÉ : `eventDate` n'est pas consommé ligne à ligne. Il
    //    l'est par la borne la plus ancienne, la plus récente, et l'histogramme
    //    de précision. Écrire ce mutant a rendu ce fait visible, et il est dit
    //    plutôt que masqué : déplacer un horodatage NON extrémal, sans changer
    //    sa classe de précision, ne change pas le digest — parce que la mesure
    //    ne prétend à AUCUN ordre intra-corpus.
    const borne = [...CORPUS];
    borne[0] = ev({ eventDate: "2025-01-08T19:47:33.000Z" });
    expect(digest(borne), "déplacer une BORNE change le digest").not.toBe(digest(CORPUS));

    const precision = [...CORPUS];
    precision[1] = ev({ txHash: "tx-0002", eventDate: "2026-04-14T00:00:00.000Z" });
    expect(digest(precision), "changer de CLASSE DE PRÉCISION change le digest").not.toBe(digest(CORPUS));
  });

  it("la liste des champs consommés et celle des non consommés sont DISJOINTES", () => {
    const c = new Set<string>(CHAMPS_CONSOMMES);
    for (const n of CHAMPS_NON_CONSOMMES) expect(c.has(n), n).toBe(false);
  });
});

// ═══ F · LA RELECTURE ═══════════════════════════════════════════════════════

describe("F · MUTANT — corps persisté ALTÉRÉ ⇒ mismatch à la relecture ⇒ refus", () => {
  const octets = serialiserCanonique(composerMesure(CORPUS, T, CODE));
  const sha = createHash("sha256").update(octets).digest("hex");

  it("des octets identiques CONCORDENT", () => {
    const r = confronterRelecture(sha, octets);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sha256).toBe(sha);
  });

  it("un seul octet altéré ⇒ NO_MATCH, et l'attendu est nommé", () => {
    const altere = Buffer.concat([octets.subarray(0, octets.length - 2), Buffer.from("X\n")]);
    const r = confronterRelecture(sha, altere);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.attendu).toBe(sha);
      expect(r.sha256).not.toBe(sha);
    }
  });

  it("un corps VIDE ne concorde pas — un hash calculable n'est pas une concordance", () => {
    expect(confronterRelecture(sha, Buffer.alloc(0)).ok).toBe(false);
  });
});

// ═══ G · L'IDENTITÉ DE L'INSTRUMENT ═════════════════════════════════════════

describe("G · MUTANT — muter identité ou version d'instrument ⇒ la mesure change", () => {
  it("la VERSION est scellée dans la mesure", () => {
    expect(digest(CORPUS, T, CODE, { name: INSTRUMENT_NAME, version: "1.0.1" })).not.toBe(digest(CORPUS));
  });

  it("le NOM est scellé dans la mesure", () => {
    expect(digest(CORPUS, T, CODE, { name: "il-measure-autre-chose", version: INSTRUMENT_VERSION })).not.toBe(digest(CORPUS));
  });

  it("l'IDENTITÉ DE CODE est scellée — « v1.0.0 » n'est pas une étiquette recollable", () => {
    expect(digest(CORPUS, T, "d".repeat(64))).not.toBe(digest(CORPUS));
  });

  it("le déclarant porte la forme EXIGÉE par le CHECK en base", () => {
    expect(DECLARANT).toBe(`instrument:${INSTRUMENT_NAME}@${INSTRUMENT_VERSION}`);
  });
});

// ═══ H · LA PROVENANCE RESTE GOUVERNÉE PAR L'AUTORITÉ EXISTANTE ═════════════
//
// Aucune nouvelle doctrine de provenance : c'est `validerQualification`, déjà
// en place, qui juge — et elle juge AVANT toute requête.

describe("H · MUTANT — MACHINE_MEASURED mal déclarée reste REFUSÉE", () => {
  const base = {
    evidenceSnapshotId: "botifymeas-0123456789abcdef",
    provenanceKind: "MACHINE_MEASURED",
    referenceKind: "DOCUMENT",
    sourceLocator: "r2://interligens-evidence/evidence/ab/abcd.json",
    sha256: "a".repeat(64),
    declaredBy: DECLARANT,
    declaredAt: new Date("2026-09-16T17:00:00.000Z"),
  } as const;

  it("NOMINAL — le déclarant de cet instrument est ACCEPTÉ", () => {
    expect(validerQualification(base).ok).toBe(true);
  });

  it("déclarant HUMAIN ⇒ REFUSED · MEASUREMENT_DECLARANT_NOT_INSTRUMENT", () => {
    const v = validerQualification({ ...base, declaredBy: "David Douville" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal.cause).toBe("MEASUREMENT_DECLARANT_NOT_INSTRUMENT");
  });

  it("version non sémantique ⇒ REFUSED — « @1.0 » n'est pas un semver", () => {
    const v = validerQualification({ ...base, declaredBy: `instrument:${INSTRUMENT_NAME}@1.0` });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal.cause).toBe("MEASUREMENT_DECLARANT_NOT_INSTRUMENT");
  });

  it("referenceKind ≠ DOCUMENT ⇒ REFUSED · MEASUREMENT_NOT_DOCUMENT", () => {
    const v = validerQualification({ ...base, referenceKind: "PUBLICATION" } as never);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal.cause).toBe("MEASUREMENT_NOT_DOCUMENT");
  });
});

// ═══ LA LIGNE QU'ON NE FRANCHIT PAS ═════════════════════════════════════════

describe("BOTIFY-MEASURE-0 · le lot s'arrête à la provenance", () => {
  it("l'instrument n'écrit NI CaseFileSource, NI CaseFileClaim, NI dépendance", async () => {
    const { codeSeul } = await import("./codeSeul");
    const source = codeSeul("src/scripts/casefile/mesure-botify-proceeds.ts");
    for (const interdit of [
      "executeFoundation", "CaseFileSource", "CaseFileClaim", "PRIMARY_OBSERVATION",
      "INFERENCE", "DERIVED_FROM", "casefile_claim_dependencies", "decidePublicRelease",
      "GRANT", "generateCaseFilePdf",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("aucune sémantique ajoutée aux étiquettes d'événement", () => {
    const rendu = JSON.stringify(composerMesure(CORPUS, T, CODE));
    // ⛔ Jamais « N KOL ont vendu », jamais « cash-out », jamais « proceeds
    //    realized » : ce sont les transformations que l'autorité manquante
    //    interdit, et les limitations les nomment explicitement.
    expect(rendu).toContain("EVENT LABEL ≠ ACTOR ATTRIBUTION");
    expect(rendu).toContain("EVENT LABEL ≠ REALIZED PROCEEDS");
    expect(rendu).toContain("TRANSFER TO CEX ≠ CASH-OUT");
    expect(rendu).toContain("distinctRecordedActorReferences");
    expect(rendu).not.toMatch(/kolsWhoSold|realizedProceeds|cashOut|sellers/i);
  });
});
