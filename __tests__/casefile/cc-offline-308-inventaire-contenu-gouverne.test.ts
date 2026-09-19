// ─── CC-OFFLINE-308 · L'INVENTAIRE DU CONTENU GOUVERNÉ ─────────────────────
//
// ██  CE N'EST PAS UN EXECUTIVE SUMMARY. C'EST UN INVENTAIRE DE CE QUE CE   ██
// ██  DOCUMENT CONTIENT.                                                    ██
//
// Le bloc ne résume NI le jeton, NI le projet, NI le risque, NI l'enquête, NI
// ce qui existerait ailleurs dans INTERLIGENS. Il compte ce que la projection
// admise contient — et `projection.claims` est sa seule entrée possible.
//
//     UNE SYNTHÈSE EST UNE PRÉSENTATION DE L'AUTORITÉ, JAMAIS UNE AUTORITÉ.
//
// ─── LE GARDE DE CONTAMINATION, ET CE QU'IL TRAVERSE RÉELLEMENT ───────────
//
// `loadCanonicalCaseFile` rend un `CanonicalCaseFile` qui porte `verdict`,
// `keyWallets`, `tigerScore`. L'assemblage les ABANDONNE — par construction,
// pas par garde : `composerAssemblage` ne recopie que le sujet, les pièces,
// les claims et les dépendances.
//
// Puisque ce lot construit précisément le résumé gouverné, le témoin ne se
// contente pas de le dire : il fait TRAVERSER un dossier canonique CHARGÉ DE
// VALEURS TOXIQUES par la vraie chaîne —
//
//     composerAssemblage → projectAssembly → renderGovernedCaseFileHtml
//
// — et exige que le bloc GOVERNED CONTENT soit OCTET POUR OCTET identique à
// celui produit depuis un dossier propre.
//
// ⛔ Aucune écriture en base. Aucune liste noire d'exécution. Aucune autorité
//    nouvelle. L'assemblage n'est pas modifié. Le garde protège LA SORTIE.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composerAssemblage } from "@/lib/casefile/authorityAssembly";
import type { CanonicalAuthorityAssembly } from "@/lib/casefile/authorityAssembly";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import type { CanonicalCaseFile } from "@/lib/casefile/canonicalReader";
import { codeSeul } from "./codeSeul";

const T = "2026-09-19T12:00:00.000Z";

// ═══ LES DOSSIERS CANONIQUES — LA FORME MESURÉE, TEXTES NEUTRES ════════════

type Deps = Parameters<typeof composerAssemblage>[1];
type Sceaux = Parameters<typeof composerAssemblage>[2];
type Lignages = Parameters<typeof composerAssemblage>[3];

const PIECE = (sourceId: string, o: Record<string, unknown> = {}) => ({
  sourceId, sourceType: "osint_x_search", caption: null, capturedAt: "2025-06-18",
  sourceUrl: `https://x.com/i/${sourceId}`, sha256: "a".repeat(64),
  evidenceLinked: true, provenanceKind: "OPERATOR_DECLARED", ...o,
});

const MESURE = (sourceId: string) => PIECE(sourceId, {
  sourceType: "SYSTEM_MEASUREMENT", capturedAt: "2026-09-16",
  sourceUrl: `r2://interligens-evidence/${sourceId}.json`, sha256: "c".repeat(64),
  provenanceKind: "MACHINE_MEASURED",
});

const CLAIM = (claimId: string, o: Record<string, unknown> = {}) => ({
  claimId, version: 1, rowNature: "PRIMARY_OBSERVATION", title: `titre de ${claimId}`,
  titleFr: null, description: null, descriptionFr: null, category: null,
  severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: [] as readonly string[], threadUrl: null, ...o,
});

/**
 * VINE — la forme mesurée : 5 observations, 1 inférence, 6 pièces distinctes,
 * 1 dépendance. Plus les HUIT assertions écartées (`rowNature` non classée,
 * aucune pièce), qui doivent ne contribuer à AUCUN compteur.
 */
const VINE_ECARTEES = ["C9", "C10", "C11", "C12", "C14", "C15", "C16", "C17"] as const;
const BOTIFY_ECARTEES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const;

const dossierVine = (o: Partial<CanonicalCaseFile> = {}): CanonicalCaseFile =>
  ({
    ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE",
    title: "VINE — dossier canonique",
    tigerScore: null,
    verdict: "UNDETERMINED", // ⚠️ MESURÉ EN BASE : le mot y est déjà écrit.
    keyWallets: [],
    sources: [
      PIECE("SRC-0xS-09"), PIECE("SRC-0xS-18"), PIECE("SRC-CKF-01"),
      PIECE("SRC-FKK-01"), PIECE("SRC-SLD-01"), MESURE("SRC-MEASURE-01"),
    ],
    claims: [
      CLAIM("VINE-0xS-01", { version: 2, evidenceRefs: ["SRC-0xS-09"] }),
      CLAIM("VINE-0xS-02", { version: 2, evidenceRefs: ["SRC-0xS-09"] }),
      CLAIM("VINE-0xS-03", { version: 2, evidenceRefs: ["SRC-0xS-18"] }),
      CLAIM("VINE-MEASURE-01", { evidenceRefs: ["SRC-MEASURE-01"] }),
      // Quatre pièces citées, dont une DÉJÀ citée ailleurs : la déduplication
      // par identité est éprouvée par la donnée, pas par une assertion isolée.
      CLAIM("VINE-MULTI-01", {
        evidenceRefs: ["SRC-0xS-09", "SRC-CKF-01", "SRC-FKK-01", "SRC-SLD-01"],
      }),
      CLAIM("VINE-CONCLUSION-01", { rowNature: "INFERENCE", evidenceRefs: [] }),
      ...VINE_ECARTEES.map((id) => CLAIM(id, { rowNature: null, evidenceRefs: [] })),
    ],
    ...o,
  }) as unknown as CanonicalCaseFile;

const dossierBotify = (o: Partial<CanonicalCaseFile> = {}): CanonicalCaseFile =>
  ({
    ref: "IL-SHILL-BOTIFY-001", codename: "BOTIFY", ticker: "$BOTIFY",
    title: "BOTIFY — dossier canonique",
    tigerScore: null, verdict: "UNDETERMINED", keyWallets: [],
    sources: [
      MESURE("SRC-BOTIFY-MEASURE-01"),
      // Les pièces des huit écartées : capture seule, tout le reste absent.
      ...BOTIFY_ECARTEES.map((_, i) =>
        PIECE(`SRC-00${i + 1}`, {
          sourceType: "screenshot", sourceUrl: null, sha256: null,
          evidenceLinked: false, provenanceKind: "UNKNOWN", capturedAt: "2024-11-04",
        }),
      ),
    ],
    claims: [
      CLAIM("BOTIFY-EVENTS-01", { evidenceRefs: ["SRC-BOTIFY-MEASURE-01"] }),
      ...BOTIFY_ECARTEES.map((id, i) =>
        CLAIM(id, { rowNature: null, evidenceRefs: [`SRC-00${i + 1}`] }),
      ),
    ],
    ...o,
  }) as unknown as CanonicalCaseFile;

const DEP_VINE: Deps = new Map([
  ["VINE-CONCLUSION-01@1", [{ claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" }]],
]);
const SANS_DEP: Deps = new Map();
const SANS_SCEAU: Sceaux = new Map();
const SANS_LIGNAGE: Lignages = new Map();

/** LA VRAIE CHAÎNE, de bout en bout, sans base et sans réseau. */
const chaine = (d: CanonicalCaseFile, deps: Deps): string => {
  const assemblage: CanonicalAuthorityAssembly = composerAssemblage(d, deps, SANS_SCEAU, SANS_LIGNAGE);
  return renderGovernedCaseFileHtml(projectAssembly(assemblage, "COUNSEL_INVESTOR"), T);
};

/** Le bloc GOVERNED CONTENT seul — c'est lui que les témoins comparent. */
const blocInventaire = (html: string): string => {
  const i = html.indexOf('<section class="inv">');
  expect(i, "le bloc GOVERNED CONTENT est absent").toBeGreaterThan(-1);
  return html.slice(i, html.indexOf("</section>", i) + "</section>".length);
};

const HTML_VINE = chaine(dossierVine(), DEP_VINE);
const HTML_BOTIFY = chaine(dossierBotify(), SANS_DEP);

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES A · B — LE LIBELLÉ, AU MOT
// ═══════════════════════════════════════════════════════════════════════════

describe("308 — le libellé est celui du ruling, au mot près", () => {
  it("PREUVE A — VINE : 5 · 1 · 6 · 1", () => {
    const bloc = blocInventaire(HTML_VINE);
    expect(bloc).toContain("<h2>GOVERNED CONTENT</h2>");
    expect(bloc).toContain("This document contains:");
    expect(bloc).toContain("<li>5 governed observations</li>");
    expect(bloc).toContain("<li>1 governed conclusion</li>");
    expect(bloc).toContain("<li>6 cited evidence pieces</li>");
    expect(bloc).toContain("<li>1 consumed governed assertion</li>");
  });

  it("PREUVE B — BOTIFY : 1 · 0 · 1 · 0", () => {
    const bloc = blocInventaire(HTML_BOTIFY);
    expect(bloc).toContain("<h2>GOVERNED CONTENT</h2>");
    expect(bloc).toContain("This document contains:");
    expect(bloc).toContain("<li>1 governed observation</li>");
    expect(bloc).toContain("<li>0 governed conclusions</li>");
    expect(bloc).toContain("<li>1 cited evidence piece</li>");
    expect(bloc).toContain("<li>0 consumed governed assertions</li>");
  });

  it("⛔ LE CHIFFRE 0, JAMAIS UNE NÉGATION QUALIFIANTE", () => {
    // ██ « 0 governed conclusions » est une CARDINALITÉ DU DOCUMENT.        ██
    // ██ « No conclusion » peut se lire comme UNE CONCLUSION SUR LE SUJET.  ██
    for (const html of [HTML_VINE, HTML_BOTIFY]) {
      const bloc = blocInventaire(html);
      for (const interdit of [
        "No governed conclusion", "No conclusion", "Nothing was established",
        "No evidence", "No relationship", "Not established", "No finding",
        "No risk", "No issue", "none", "None", "absent", "Absent",
      ]) {
        expect(bloc, `« ${interdit} » qualifie au lieu de compter`).not.toContain(interdit);
      }
    }
  });

  it("le préambule FIXE l'univers de quantification, et il précède les nombres", () => {
    // Sans lui, le bloc pourrait se lire « INTERLIGENS a cherché partout et n'a
    // rien trouvé ». Avec lui, il ne peut dire qu'une chose : CE document.
    const bloc = blocInventaire(HTML_BOTIFY);
    expect(bloc.indexOf("This document contains:")).toBeLessThan(bloc.indexOf("<li>"));
  });

  it("le singulier n'apparaît QUE pour 1 — zéro prend le pluriel", () => {
    const bloc = blocInventaire(HTML_BOTIFY);
    expect(bloc).not.toContain("<li>0 governed conclusion</li>");
    expect(bloc).not.toContain("<li>0 consumed governed assertion</li>");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES C · D · E — L'ORIGINE DES NOMBRES
// ═══════════════════════════════════════════════════════════════════════════

describe("308 — les quatre nombres ne viennent QUE de la projection", () => {
  it("PREUVE C — ils sont recalculables depuis ProjectedCaseFile, et ils coïncident", () => {
    const p = projectAssembly(
      composerAssemblage(dossierVine(), DEP_VINE, SANS_SCEAU, SANS_LIGNAGE),
      "COUNSEL_INVESTOR",
    );
    const obs = p.claims.filter((c) => c.rowNature !== "INFERENCE").length;
    const con = p.claims.filter((c) => c.rowNature === "INFERENCE").length;
    const pieces = new Set(p.claims.flatMap((c) => c.citedSources.map((s) => s.sourceId))).size;
    const deps = p.claims.reduce((n, c) => n + c.dependencies.length, 0);
    expect([obs, con, pieces, deps]).toEqual([5, 1, 6, 1]);

    const bloc = blocInventaire(HTML_VINE);
    expect(bloc).toContain(`<li>${obs} governed observations</li>`);
    expect(bloc).toContain(`<li>${con} governed conclusion</li>`);
    expect(bloc).toContain(`<li>${pieces} cited evidence pieces</li>`);
    expect(bloc).toContain(`<li>${deps} consumed governed assertion</li>`);
  });

  it("PREUVE D — les pièces citées sont DÉDUPLIQUÉES PAR IDENTITÉ", () => {
    // `SRC-0xS-09` est citée par TROIS claims projetées. Le total des citations
    // vaut 8 ; le nombre de PIÈCES vaut 6. Le bloc compte des pièces.
    const p = projectAssembly(
      composerAssemblage(dossierVine(), DEP_VINE, SANS_SCEAU, SANS_LIGNAGE),
      "COUNSEL_INVESTOR",
    );
    const citations = p.claims.reduce((n, c) => n + c.citedSources.length, 0);
    expect(citations, "le témoin serait vide si aucune pièce n'était citée deux fois").toBe(8);
    expect(blocInventaire(HTML_VINE)).toContain("<li>6 cited evidence pieces</li>");
    expect(blocInventaire(HTML_VINE)).not.toContain("<li>8 cited evidence pieces</li>");
  });

  it("PREUVE E — les seize assertions écartées ne contribuent à AUCUN compteur", () => {
    // Elles SONT dans le dossier canonique en entrée — sinon le témoin serait
    // vide — et elles ne franchissent pas la projection.
    expect(dossierVine().claims.map((c) => c.claimId)).toEqual(
      expect.arrayContaining([...VINE_ECARTEES]),
    );
    expect(dossierBotify().claims.map((c) => c.claimId)).toEqual(
      expect.arrayContaining([...BOTIFY_ECARTEES]),
    );
    // VINE : 5 + 1 alors que 14 claims sont en entrée. BOTIFY : 1 sur 9.
    expect(dossierVine().claims).toHaveLength(14);
    expect(dossierBotify().claims).toHaveLength(9);
    expect(blocInventaire(HTML_VINE)).toContain("<li>5 governed observations</li>");
    expect(blocInventaire(HTML_BOTIFY)).toContain("<li>1 governed observation</li>");
    // Et leurs pièces ne gonflent pas le compte : BOTIFY en cite HUIT de plus.
    expect(dossierBotify().sources).toHaveLength(9);
    expect(blocInventaire(HTML_BOTIFY)).toContain("<li>1 cited evidence piece</li>");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE F — LE GARDE DE CONTAMINATION LEGACY
// ═══════════════════════════════════════════════════════════════════════════
//
// On charge le dossier canonique de valeurs TOXIQUES ET RECONNAISSABLES, on le
// fait traverser la VRAIE chaîne, et on exige que le bloc soit OCTET POUR
// OCTET celui du dossier propre.

const TOXIQUE = "TOXIQUE-308";

/** Les champs hérités, chargés de marqueurs reconnaissables. */
const CONTAMINATION = {
  tigerScore: 97,
  verdict: `${TOXIQUE}-SCAM-CONFIRMED`,
  keyWallets: [
    { role: `${TOXIQUE}-Deployer-nommé`, address: `${TOXIQUE}-addr-1` },
    { role: `${TOXIQUE}-Dev-wallet`, address: `${TOXIQUE}-addr-2` },
    { role: `${TOXIQUE}-Top-holder`, address: `${TOXIQUE}-addr-3` },
    { role: `${TOXIQUE}-Genesis-sniper`, address: `${TOXIQUE}-addr-4` },
  ],
  // ⚠️ `summary`, `summaryFr` et `bodyMarkdown` ne figurent PAS sur
  //    `CanonicalCaseFile` et ne sont pas lus par `canonicalReader` — mesuré le
  //    2026-09-19, et leurs colonnes sont NULL sur les deux dossiers. On les
  //    pose quand même EN TROP : le garde protège la FRONTIÈRE, pas l'état
  //    actuel du lecteur. Si un jour le lecteur se mettait à les porter, ce
  //    témoin dirait immédiatement si le bloc s'en trouve changé.
  summary: `${TOXIQUE} summary: coordinated campaign confirmed`,
  summaryFr: `${TOXIQUE} synthèse : campagne coordonnée confirmée`,
  bodyMarkdown: `# ${TOXIQUE}\n\nVerdict: AVOID. 62 % concentration.`,
  // Un `actors[]` hérité, posé au même endroit, pour la preuve G.
  actors: [{ name: `${TOXIQUE}-acteur`, role: "insider" }],
} as unknown as Partial<CanonicalCaseFile>;

describe("308/F — aucun champ hérité ne peut contaminer le bloc", () => {
  it("TÉMOIN DE NON-VACUITÉ — la contamination est bien PRÉSENTE en entrée", () => {
    // Un garde qui mute un objet ignoré rend le même vert qu'une frontière
    // tenue. On vérifie d'abord que les marqueurs sont là.
    const d = dossierVine(CONTAMINATION) as unknown as Record<string, unknown>;
    expect(JSON.stringify(d)).toContain(TOXIQUE);
    expect(d.verdict).toBe(`${TOXIQUE}-SCAM-CONFIRMED`);
    expect((d.keyWallets as unknown[]).length).toBe(4);
    expect(d.tigerScore).toBe(97);
  });

  it("PREUVE F — le bloc est OCTET POUR OCTET identique, VINE et BOTIFY", () => {
    expect(blocInventaire(chaine(dossierVine(CONTAMINATION), DEP_VINE)))
      .toBe(blocInventaire(HTML_VINE));
    expect(blocInventaire(chaine(dossierBotify(CONTAMINATION), SANS_DEP)))
      .toBe(blocInventaire(HTML_BOTIFY));
  });

  it("PREUVES F·G·J — et AUCUN marqueur toxique n'atteint le document entier", () => {
    for (const html of [
      chaine(dossierVine(CONTAMINATION), DEP_VINE),
      chaine(dossierBotify(CONTAMINATION), SANS_DEP),
    ]) {
      expect(html, "un champ hérité a traversé la frontière").not.toContain(TOXIQUE);
      // PREUVE J — aucun verdict synthétique, sous aucune forme.
      for (const mot of ["UNDETERMINED", "SCAM", "AVOID", "SAFE", "WARNING", "CONFIRMED", "62 %"]) {
        expect(html, mot).not.toContain(mot);
      }
      // PREUVE G — `actors[]` ne contribue pas.
      expect(html).not.toContain("insider");
    }
  });

  it("le verdict RÉEL mesuré en base — `UNDETERMINED` — n'apparaît pas davantage", () => {
    // Il est écrit en base sur LES DEUX dossiers. Le document ne le porte pas.
    expect(dossierVine().verdict).toBe("UNDETERMINED");
    expect(dossierBotify().verdict).toBe("UNDETERMINED");
    expect(HTML_VINE).not.toContain("UNDETERMINED");
    expect(HTML_BOTIFY).not.toContain("UNDETERMINED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES H · I · K — CE QUI NE CONTRIBUE PAS, ET CE QUI N'EST PAS DIT
// ═══════════════════════════════════════════════════════════════════════════

describe("308 — rien de vivant, rien d'interprétatif", () => {
  it("PREUVES H·I — aucune table non gouvernée, aucun état live n'est atteignable", () => {
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    for (const s of [
      "KolProceedsEvent", "KolTokenLink", "WalletFundingEdge", "FundingEdge",
      "FundingRelationshipObservation", "prisma", "$queryRaw", "fetch(",
      "keyWallets", "tigerScore", "verdict", "summary", "bodyMarkdown", "actors",
    ]) {
      expect(code, `le renderer atteint « ${s} »`).not.toContain(s);
    }
  });

  it("PREUVE I — BOTIFY affiche 1, jamais un recomptage d'événements", () => {
    // ██ LE TEXTE HISTORIQUE DE BOTIFY-EVENTS-01 RESTE L'AUTORITÉ PORTANT SA ██
    // ██ MESURE HISTORIQUE. LIVE STATE ≠ HISTORICAL MEASUREMENT.            ██
    const bloc = blocInventaire(HTML_BOTIFY);
    expect(bloc).toContain("<li>1 governed observation</li>");
    for (const n of ["270", "262", "23 ", "20 "]) {
      expect(bloc, `un recomptage « ${n} » est apparu`).not.toContain(n);
    }
  });

  it("PREUVE K — aucune phrase interprétative n'est ajoutée", () => {
    // Le bloc ne contient QUE : son titre, son préambule, et quatre lignes
    // « <nombre> <catégorie> ». Rien d'autre ne subsiste au dépouillement.
    for (const html of [HTML_VINE, HTML_BOTIFY]) {
      const reste = blocInventaire(html)
        .replace(/<[^>]+>/g, " ")
        .replace("GOVERNED CONTENT", "")
        .replace("This document contains:", "")
        .replace(/\d+ (governed observations?|governed conclusions?|cited evidence pieces?|consumed governed assertions?)/g, "")
        .replace(/\s+/g, "");
      expect(reste, `du texte non prévu subsiste : « ${reste} »`).toBe("");
    }
  });

  it("aucune pondération, aucun classement, aucun résumé de severity ou category", () => {
    for (const html of [HTML_VINE, HTML_BOTIFY]) {
      const bloc = blocInventaire(html);
      for (const mot of ["severity", "Severity", "category", "Category", "rank", "weight", "score", "HIGH", "CRITICAL"]) {
        expect(bloc, mot).not.toContain(mot);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES L · M — L'ASYMÉTRIE RESTE, ET ELLE EST VRAIE
// ═══════════════════════════════════════════════════════════════════════════

describe("308 — l'asymétrie VINE / BOTIFY est préservée", () => {
  it("PREUVE L — VINE-CONCLUSION-01 reste rendue, relation DERIVED_FROM enrichie", () => {
    expect(HTML_VINE).toContain("Governed conclusions");
    expect(HTML_VINE).toContain("Consumed governed assertions");
    expect(HTML_VINE).toContain("DERIVED_FROM");
    // L'enrichissement de CC-OFFLINE-306 : le titre et la nature de la cible.
    expect(HTML_VINE).toContain("titre de VINE-MEASURE-01");
    expect(HTML_VINE).toContain("<code>VINE-MEASURE-01</code> v1");
  });

  it("PREUVE M — BOTIFY reste SANS section GOVERNED CONCLUSIONS", () => {
    // ██ L'inventaire PEUT dire « 0 governed conclusions » parce qu'il COMPTE ██
    // ██ LE DOCUMENT. Il NE PEUT PAS expliquer POURQUOI il y en a zéro.      ██
    expect(HTML_BOTIFY).not.toContain("Governed conclusions");
    expect(HTML_BOTIFY).not.toContain("Consumed governed assertions");
    expect(HTML_BOTIFY).not.toContain("DERIVED_FROM");
    // Et rien n'est fabriqué à partir des huit écartées : ni limitation, ni
    // refus, ni absence de finding, ni conclusion négative.
    for (const mot of [
      "limitation", "Limitation", "withheld", "Withheld", "could not",
      "was not found", "no attribution", "insufficient",
    ]) {
      expect(HTML_BOTIFY, mot).not.toContain(mot);
    }
  });

  it("BOTIFY reste SILENCIEUX sur ce qui n'est pas affirmé — seul le compte parle", () => {
    const bloc = blocInventaire(HTML_BOTIFY);
    expect(bloc).toContain("<li>0 governed conclusions</li>");
    // La seule occurrence du mot « conclusion » dans tout le document BOTIFY
    // est cette ligne de comptage.
    expect(HTML_BOTIFY.match(/conclusion/gi)).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE N — LE LOT NE TOUCHE AUCUN ARTEFACT
// ═══════════════════════════════════════════════════════════════════════════

describe("308/N — aucun artefact historique n'est atteint", () => {
  it("le renderer ne nomme ni R2, ni le registre d'artefacts", () => {
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    for (const s of ["governed_objects", "produireArtefactGouverne", "S3Client", "PutObject", "signedUrl", "remettreOctetsGouvernes"]) {
      expect(code, `le renderer atteint « ${s} »`).not.toContain(s);
    }
  });
});
