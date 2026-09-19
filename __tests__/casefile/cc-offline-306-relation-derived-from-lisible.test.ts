// ─── CC-OFFLINE-306 · A — LA RELATION DEVIENT UNE PHRASE ───────────────────
//
// ██  L'AUTORITÉ DISPONIBLE SUPPORTE claim↔evidence ET claim↔claim VIA      ██
// ██  DERIVED_FROM. ELLE NE SUPPORTE PAS un graphe wallet↔acteur,           ██
// ██  funder↔bénéficiaire ou compte↔token. ON N'INVENTE PAS CETTE AUTORITÉ  ██
// ██  POUR RENDRE LA DÉMO PLUS SPECTACULAIRE.                               ██
//
// Avant ce lot, l'humain lisait :
//
//     CONSUMED GOVERNED ASSERTIONS
//         DERIVED_FROM → VINE-MEASURE-01 v1
//
// Un code et un identifiant. Pour comprendre le lien, il fallait remonter à une
// autre section et faire la jointure de tête. Désormais :
//
//     DERIVED_FROM
//     → <titre exact de la cible>
//     → VINE-MEASURE-01 v1
//     → PRIMARY_OBSERVATION
//
// SOURCE D'AUTORITÉ UNIQUE : `projection.claims`, déjà remise au renderer.
// Aucune donnée ne manquait ; c'est la JOINTURE qui manquait.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import type { AudienceScopedCaseFile, ProjectedClaim } from "@/lib/casefile/audienceProjection";
import type {
  AssembledClaim,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "@/lib/casefile/authorityAssembly";
import { codeSeul } from "./codeSeul";

const T = "2026-09-19T12:00:00.000Z";

// ═══ LES FIXTURES — LA FORME MESURÉE DU DOSSIER VINE ════════════════════════

const MESURE_SRC: AssembledSource = {
  sourceId: "SRC-MEASURE-01", sourceType: "SYSTEM_MEASUREMENT", caption: null,
  capturedAt: "2026-09-16", sourceUrl: "r2://interligens-evidence/evidence/m.json",
  sha256: "c".repeat(64), snapshotLinked: true, provenanceKind: "MACHINE_MEASURED",
  journalId: "2", sourceLocator: "r2://interligens-evidence/evidence/m.json",
  declaredBy: "instrument:il-measure-vine-wallet-attribution@1.0.0",
};

// Le titre RÉEL de la cible, mesuré en base le 2026-09-19. Il est reproduit ici
// parce que c'est EXACTEMENT ce que la preuve n° 2 exige de voir apparaître.
const TITRE_CIBLE =
  "Bounded measurement: no founded actor-wallet attribution and no admissible " +
  "wallet-token bridge found in the governed corpus";

const CLAIM = (o: Partial<AssembledClaim> & Pick<AssembledClaim, "claimId">): AssembledClaim => ({
  version: 1, rowNature: "PRIMARY_OBSERVATION", title: `titre de ${o.claimId}`,
  titleFr: null, description: null, descriptionFr: null, category: null,
  severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: [], contentHash: "b".repeat(64), ...o,
});

const VINE: CanonicalAuthorityAssembly = {
  subject: { ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE", title: "VINE" },
  sources: [MESURE_SRC],
  claims: [
    CLAIM({ claimId: "VINE-MEASURE-01", title: TITRE_CIBLE, evidenceRefs: ["SRC-MEASURE-01"] }),
    CLAIM({ claimId: "VINE-CONCLUSION-01", rowNature: "INFERENCE", evidenceRefs: [] }),
  ],
  dependencies: [
    {
      dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1,
      sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM",
    },
  ],
};

const rendu = (a: CanonicalAuthorityAssembly) =>
  renderGovernedCaseFileHtml(projectAssembly(a, "COUNSEL_INVESTOR"), T);

/** Le bloc de la conclusion seul — pour ne pas confondre avec la section des pièces. */
const blocConclusion = (html: string): string => {
  const i = html.indexOf("Consumed governed assertions");
  expect(i, "aucune dépendance rendue").toBeGreaterThan(-1);
  return html.slice(i, html.indexOf("</ul>", i));
};

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES 1 · 2 · 3 — LA RELATION, SON CONTENU, ET CE QU'ELLE N'AFFIRME PAS
// ═══════════════════════════════════════════════════════════════════════════

describe("306/A — la relation DERIVED_FROM est rendue, et elle est lisible", () => {
  it("PREUVE 1 — VINE-CONCLUSION-01 rend TOUJOURS DERIVED_FROM VINE-MEASURE-01@1", () => {
    const bloc = blocConclusion(rendu(VINE));
    expect(bloc).toContain("DERIVED_FROM");
    expect(bloc).toContain("<code>VINE-MEASURE-01</code> v1");
  });

  it("PREUVE 2 — le TITRE EXACT et la NATURE de la cible, depuis projection.claims", () => {
    const bloc = blocConclusion(rendu(VINE));
    expect(bloc, "le titre exact de la cible manque").toContain(TITRE_CIBLE);
    expect(bloc, "la nature de la cible manque").toContain("PRIMARY_OBSERVATION");
  });

  it("PREUVE 2bis — le titre rendu est celui de la CIBLE, pas celui de la dépendante", () => {
    // Un mutant naturel : afficher le titre de la claim courante au lieu de
    // celui qu'elle consomme. Le témoin le distingue.
    const bloc = blocConclusion(rendu(VINE));
    expect(bloc).not.toContain("titre de VINE-CONCLUSION-01");
  });

  it("PREUVE 3 — AUCUN wording n'en fait une causalité, une vérité ou une attribution", () => {
    const html = rendu(VINE);
    for (const mot of [
      "because", "Because", "therefore", "Therefore", "caused by", "Caused by",
      "attributed to", "Attributed to", "proves", "demonstrates", "establishes that",
      "implies", "confirms", "shows that", "responsible", "linked to", "connected to",
    ]) {
      expect(html, `« ${mot} » a été ajouté au rendu`).not.toContain(mot);
    }
  });

  it("PREUVE 3bis — les seuls mots de la relation sont ceux de la DONNÉE", () => {
    // Ce que le bloc contient : le `kind` porté en base, le titre de la cible,
    // son identité, sa version, sa nature. Et le libellé de section, inchangé.
    const bloc = blocConclusion(rendu(VINE))
      .replace("Consumed governed assertions", "")
      .replace(/<[^>]+>/g, " ")
      .replace(/→/g, " ")
      .replace(TITRE_CIBLE, "")
      .replace(/DERIVED_FROM|VINE-MEASURE-01|v1|PRIMARY_OBSERVATION/g, "")
      .replace(/\s+/g, "");
    expect(bloc, `du texte non gouverné subsiste : « ${bloc} »`).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 4 — FAIL-CLOSED
// ═══════════════════════════════════════════════════════════════════════════

describe("306/A — cible absente de la projection : on rend MOINS, jamais du faux", () => {
  /** La dépendance épingle une version qui n'existe pas. */
  const VERSION_DEPINGLEE: CanonicalAuthorityAssembly = {
    ...VINE,
    dependencies: [{ ...VINE.dependencies[0], sourceVersion: 7 }],
  };

  it("PREUVE 4 — identifiant et version SEULS, exactement comme avant le lot", () => {
    // ⚠️ Une dépendance non résolue rend aussi la claim non fondable : c'est le
    //    contrat, et il précède le rendu. On éprouve donc le repli sur une
    //    projection où la conclusion EST admise mais la cible ne l'est pas.
    const projection: AudienceScopedCaseFile = {
      subject: VINE.subject,
      audience: "COUNSEL_INVESTOR",
      state: "GOVERNED_CLAIMS",
      claims: [
        {
          ...CLAIM({ claimId: "VINE-CONCLUSION-01", rowNature: "INFERENCE" }),
          admittedBy: "COUNSEL_INVESTOR",
          citedSources: [],
          dependencies: [VINE.dependencies[0]],
        } as ProjectedClaim,
      ],
    };
    const bloc = blocConclusion(renderGovernedCaseFileHtml(projection, T));
    expect(bloc).toContain("<code>DERIVED_FROM</code> → <code>VINE-MEASURE-01</code> v1");
    // ⛔ Rien n'a été inventé : ni titre, ni nature.
    expect(bloc).not.toContain(TITRE_CIBLE);
    expect(bloc).not.toContain("PRIMARY_OBSERVATION");
    expect(bloc).not.toContain("—");
    expect(bloc).not.toContain("null");
    expect(bloc).not.toContain("undefined");
  });

  it("une version DÉPINGLÉE ne se rabat PAS sur une version voisine", () => {
    // La résolution est `claimId@version`, EXACTE. Un repli sur « la version la
    // plus proche » serait une autorité inventée.
    const html = rendu(VERSION_DEPINGLEE);
    if (html.includes("Consumed governed assertions")) {
      const bloc = blocConclusion(html);
      expect(bloc).not.toContain(TITRE_CIBLE);
    }
    // Et la conclusion elle-même n'est pas fondable : le contrat l'écarte.
    expect(
      projectAssembly(VERSION_DEPINGLEE, "COUNSEL_INVESTOR").claims
        .some((c) => c.claimId === "VINE-CONCLUSION-01"),
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 5 — PAS DE PARITÉ VINE / BOTIFY
// ═══════════════════════════════════════════════════════════════════════════

describe("306/A — BOTIFY reste honnêtement plus pauvre", () => {
  const BOTIFY: CanonicalAuthorityAssembly = {
    subject: { ref: "IL-SHILL-BOTIFY-001", codename: "BOTIFY", ticker: "$BOTIFY", title: "BOTIFY" },
    sources: [{ ...MESURE_SRC, sourceId: "SRC-BOTIFY-MEASURE-01" }],
    claims: [CLAIM({ claimId: "BOTIFY-EVENTS-01", evidenceRefs: ["SRC-BOTIFY-MEASURE-01"] })],
    dependencies: [],
  };

  it("PREUVE 5 — aucune section Governed Conclusions, et AUCUNE relation fabriquée", () => {
    // ██ VINE DÉMONTRE UNE RELATION GOUVERNÉE. BOTIFY DÉMONTRE LA RETENUE   ██
    // ██ LORSQUE CETTE RELATION N'EST PAS FONDÉE. Une asymétrie VRAIE vaut  ██
    // ██ mieux qu'une symétrie fabriquée.                                    ██
    const html = rendu(BOTIFY);
    expect(html).not.toContain("Governed conclusions");
    expect(html).not.toContain("Consumed governed assertions");
    expect(html).not.toContain("DERIVED_FROM");
    // Et son observation, elle, est bien là.
    expect(html).toContain("Governed observations");
    expect(html).toContain("BOTIFY-EVENTS-01");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES 8 · 9 · 10 · 11 — CE QUE LA CHAÎNE NE CONSOMME PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// `FundingRelationshipObservation` mérite son nom ici. Elle porte `rowNature`
// INFERENCE, `natureBasis`, `methodRef`, `inference-envelope@v2`,
// `coverageIsFloor` — toute la machinerie. Et son `contextRef` est
// `CASE-2025-VINE-001`, PAS `IL-SHILL-VINE-001` : elle est HORS du périmètre
// gouverné, et `VINE-MEASURE-01` l'a explicitement exclue.
//
//     ROW NATURE + METHOD REF + INFERENCE ENVELOPE ≠ FONDATION DU DOSSIER.

const CHAINE = [
  "src/lib/casefile/governedCaseFileRenderer.ts",
  "src/lib/casefile/audienceProjection.ts",
  "src/lib/casefile/authorityAssembly.ts",
];

/** Les PURES — elles ne lisent aucune base, et c'est une propriété tenue. */
const PURES = [
  "src/lib/casefile/governedCaseFileRenderer.ts",
  "src/lib/casefile/audienceProjection.ts",
];

const INTERDITS_DE_CONSOMMATION = [
  "actors",
  "FundingRelationshipObservation",
  "WalletFundingEdge",
  "FundingEdge",
  "KolTokenLink",
  "KolProceedsEvent",
  "natureBasis",
  "methodRef",
  "inference-envelope",
  "coverageIsFloor",
  "CASE-2025-VINE-001",
];

describe("306/A — la chaîne ne consomme RIEN d'autre que la projection", () => {
  it("PREUVES 8·9·10 — aucun de ces symboles n'est émis par la chaîne", () => {
    for (const f of CHAINE) {
      const code = codeSeul(readFileSync(f, "utf8"));
      for (const s of INTERDITS_DE_CONSOMMATION) {
        expect(code, `${f} émet « ${s} »`).not.toContain(s);
      }
    }
  });

  it("et les deux maillons PURS ne lisent aucune base", () => {
    // ⚠️ `authorityAssembly` N'EST PAS dans cette liste, et le prétendre serait
    //    faux : elle EST la frontière de base, c'est sa fonction. Ce qui compte
    //    est qu'au-delà d'elle, plus rien ne lit. Un témoin qui interdirait
    //    Prisma partout mentirait sur l'architecture pour paraître plus strict.
    for (const f of PURES) {
      const code = codeSeul(readFileSync(f, "utf8"));
      for (const s of ["prisma", "$queryRaw", "findMany", "findFirst"]) {
        expect(code, `${f} lit la base via « ${s} »`).not.toContain(s);
      }
    }
  });

  it("PREUVE 11 — le renderer ne touche ni le registre d'artefacts ni R2", () => {
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    for (const s of ["governed_objects", "produireArtefactGouverne", "S3Client", "PutObject", "signedUrl"]) {
      expect(code, `le renderer émet « ${s} »`).not.toContain(s);
    }
  });

  it("aucun NOUVEAU dependency_kind n'est introduit", () => {
    // Le renderer rend le `kind` qu'il REÇOIT. Il n'en nomme aucun, donc il
    // ne peut pas en inventer un — et `DERIVED_FROM` n'est pas écrit en dur.
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    for (const k of ["DERIVED_FROM", "CORROBORATES", "CONTRADICTS", "SUPPORTS", "REFUTES"]) {
      expect(code, `le renderer nomme le kind « ${k} »`).not.toContain(k);
    }
  });

  it("l'index ne se construit QUE depuis la projection reçue", () => {
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    expect(code).toContain("indexerProjection(projection.claims)");
    // UN SEUL site d'appel, et son unique argument est la projection reçue.
    // S'il en apparaissait un second, il faudrait vérifier ce qu'il indexe.
    expect(code.match(/indexerProjection\(/g)).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE RENDU RESTE CE QU'IL ÉTAIT — DÉTERMINISTE, ET SANS SCORE
// ═══════════════════════════════════════════════════════════════════════════

describe("306/A — ce que le lot ne change pas", () => {
  it("le rendu reste DÉTERMINISTE — même entrée, mêmes octets", () => {
    expect(rendu(VINE)).toBe(rendu(VINE));
  });

  it("aucun score, sous aucune forme", () => {
    const html = rendu(VINE);
    for (const mot of ["/100", "TigerScore", "riskScore", "score"]) {
      expect(html, mot).not.toContain(mot);
    }
  });

  it("MUTANT — le titre de la cible vient de la MÊME règle que le bloc de claim", () => {
    // `titleFr ?? title`, une seule fois, utilisée aux deux endroits. Si la
    // dépendance choisissait l'autre champ, le même objet porterait deux noms
    // dans le même document.
    const avecFr: CanonicalAuthorityAssembly = {
      ...VINE,
      claims: VINE.claims.map((c) =>
        c.claimId === "VINE-MEASURE-01" ? { ...c, titleFr: "TITRE-FR-306" } : c,
      ),
    };
    const html = rendu(avecFr);
    expect(blocConclusion(html)).toContain("TITRE-FR-306");
    expect(html).toContain("<h3>TITRE-FR-306</h3>");
    expect(html).not.toContain(TITRE_CIBLE);
  });
});
