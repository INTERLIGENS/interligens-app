// ─── BUILD 9 / ÉTAPE 6 — VERSIONNER SANS RÉÉCRIRE ──────────────────────────
//
// Deux propriétés, et elles sont indépendantes :
//
//   le lecteur ne mélange pas les versions   (immuabilité, moitié applicative)
//   une modification en place se détecte     (immuabilité, moitié probatoire)
//
// Plus une distinction qui n'est pas cosmétique : une référence CASSÉE et une
// référence qui n'a jamais été une clef de registre ne se traitent pas
// pareil, et les confondre produirait une conclusion négative de plus.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  claimContentHash,
  latestVersions,
  classifyReference,
  auditClaims,
  summarizeFindings,
  SEALED_FIELDS,
  type AuditableClaim,
  type SealableClaim,
} from "@/lib/casefile/versioning";

const base: SealableClaim = {
  claimId: "C1",
  title: "Coordinated posting",
  titleFr: "Publication coordonnée",
  description: "Plusieurs comptes publient le même modèle.",
  descriptionFr: null,
  category: "social",
  severity: "HIGH",
  status: "CONFIRMED",
  claimDate: "2025-11-04",
  actors: ["@a", "@b"],
  threadUrl: "https://x.com/exemple/status/1",
  evidenceRefs: ["SRC-001", "SRC-002"],
};

const auditable = (o: Partial<AuditableClaim> = {}): AuditableClaim => ({
  ...base,
  version: 1,
  contentHash: claimContentHash(base),
  ...o,
});

const REGISTRE = new Set(["SRC-001", "SRC-002"]);

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// ═══ Le sceau ═════════════════════════════════════════════════════════════

describe("ÉTAPE 6 — le sceau scelle le contenu, et seulement lui", () => {
  it("le même contenu rend la même empreinte", () => {
    expect(claimContentHash(base)).toBe(claimContentHash({ ...base }));
  });

  it("MUTANT — changer un mot du titre casse le sceau", () => {
    expect(claimContentHash({ ...base, title: "Coordinated postings" })).not.toBe(
      claimContentHash(base),
    );
  });

  it("chaîne vide et absence ne rendent PAS la même empreinte", () => {
    // Sans le séparateur, remplacer `""` par `null` passerait inaperçu — et
    // c'est exactement le genre de substitution qu'un sceau doit voir.
    expect(claimContentHash({ ...base, titleFr: "" })).not.toBe(
      claimContentHash({ ...base, titleFr: null }),
    );
  });

  it("réordonner des références ne casse PAS le sceau", () => {
    // L'ordre des refs ne change pas ce que le claim affirme.
    expect(claimContentHash({ ...base, evidenceRefs: ["SRC-002", "SRC-001"] })).toBe(
      claimContentHash(base),
    );
  });

  it("RETIRER une référence casse le sceau", () => {
    expect(claimContentHash({ ...base, evidenceRefs: ["SRC-001"] })).not.toBe(
      claimContentHash(base),
    );
  });

  it("l'empreinte ne dépend pas de l'ordre de construction de l'objet", () => {
    // `JSON.stringify` d'un objet dépend de l'ordre d'insertion des clefs.
    // Une empreinte qui en dépendrait ne scellerait rien.
    const inverse: SealableClaim = {
      evidenceRefs: base.evidenceRefs,
      threadUrl: base.threadUrl,
      actors: base.actors,
      claimDate: base.claimDate,
      status: base.status,
      severity: base.severity,
      category: base.category,
      descriptionFr: base.descriptionFr,
      description: base.description,
      titleFr: base.titleFr,
      title: base.title,
      claimId: base.claimId,
    };
    expect(claimContentHash(inverse)).toBe(claimContentHash(base));
  });

  it("MUTANT — l'ÉTAT n'entre pas dans le sceau", () => {
    // Sinon toute promotion ATTACHED → PUBLIC casserait l'empreinte, et un
    // sceau qui casse à chaque décision légitime finit par être ignoré.
    expect(SEALED_FIELDS as readonly string[]).not.toContain("state");
    expect(SEALED_FIELDS as readonly string[]).not.toContain("version");
    expect(SEALED_FIELDS as readonly string[]).not.toContain("exclusionReason");
    expect(codeSeul("src/lib/casefile/versioning.ts")).not.toContain('"updatedAt"');
  });
});

// ═══ La sélection de version ══════════════════════════════════════════════

describe("ÉTAPE 6 — le lecteur ne mélange pas les versions", () => {
  it("deux versions du même claim ⇒ la DERNIÈRE, une seule fois", () => {
    const rows = [
      { claimId: "C1", version: 1, marque: "vieille" },
      { claimId: "C1", version: 2, marque: "actuelle" },
    ];
    const out = latestVersions(rows);
    expect(out).toHaveLength(1);
    expect(out[0].marque).toBe("actuelle");
  });

  it("l'ordre d'arrivée des lignes ne change rien", () => {
    const desc = latestVersions([
      { claimId: "C1", version: 3, m: "c" },
      { claimId: "C1", version: 1, m: "a" },
      { claimId: "C1", version: 2, m: "b" },
    ]);
    expect(desc[0].m).toBe("c");
  });

  it("des claims distincts sont tous conservés, triés", () => {
    const out = latestVersions([
      { claimId: "C2", version: 1 },
      { claimId: "C1", version: 1 },
    ]);
    expect(out.map((c) => c.claimId)).toEqual(["C1", "C2"]);
  });

  it("MUTANT — le lecteur canonique passe bien par la sélection", () => {
    const code = codeSeul("src/lib/casefile/canonicalReader.ts");
    expect(code).toContain("latestVersions(claimRows)");
    expect(code).toContain("version");
  });
});

// ═══ Références : cassée ou jamais posée ══════════════════════════════════

describe("ÉTAPE 6 — une référence cassée n'est pas une référence absente", () => {
  it("une clef qui résout est RESOLVED", () => {
    expect(classifyReference("SRC-001", REGISTRE)).toBe("RESOLVED");
  });

  it("une clef en bonne forme qui ne résout pas est BROKEN", () => {
    expect(classifyReference("SRC-404", REGISTRE)).toBe("BROKEN");
  });

  it("de la prose n'a JAMAIS été une clef — UNCLASSIFIED, pas BROKEN", () => {
    // Les 33 références en prose de VINE ne sont pas des liens cassés : ce
    // sont des références qui n'ont jamais été posées. Les appeler cassées
    // ajouterait une conclusion négative que rien ne démontre.
    for (const prose of ["screenshots TBC", "voir le fil", "cf. capture n°3"]) {
      expect(classifyReference(prose, REGISTRE), prose).toBe("UNCLASSIFIED");
    }
  });
});

// ═══ L'audit ══════════════════════════════════════════════════════════════

describe("ÉTAPE 6 — l'audit constate, il n'accuse pas", () => {
  it("un dossier scellé et cohérent ne produit AUCUN constat", () => {
    expect(auditClaims([auditable()], REGISTRE)).toEqual([]);
  });

  it("un sceau absent est UNSEALED — jamais CONTENT_MUTATED", () => {
    // NULL veut dire « jamais scellé », pas « modifié ». Les 16 claims migrés
    // au bloc 4 sont dans ce cas. Confondre les deux transformerait une
    // absence en accusation.
    const c = auditClaims([auditable({ contentHash: null })], REGISTRE);
    expect(c.map((x) => x.kind)).toEqual(["UNSEALED"]);
  });

  it("MUTANT — un contenu modifié SOUS un sceau existant est détecté", () => {
    const c = auditClaims(
      [auditable({ title: "Titre réécrit après coup" })],
      REGISTRE,
    );
    expect(c.map((x) => x.kind)).toEqual(["CONTENT_MUTATED"]);
    expect(c[0].field).toBe("contentHash");
  });

  it("une version supplantée modifiée après coup est détectée, elle aussi", () => {
    // Le passé est ce qui doit être immuable. Un audit qui ne regarderait que
    // la dernière version raterait exactement ce qu'il cherche.
    const v1 = auditable({ version: 1, description: "réécrite" });
    const v2 = auditable({ version: 2 });
    const c = auditClaims([v1, v2], REGISTRE);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "CONTENT_MUTATED", version: 1 });
  });

  it("une référence cassée est constatée, la prose ne l'est pas", () => {
    const c = auditClaims(
      [
        auditable({
          evidenceRefs: ["SRC-001", "SRC-404", "screenshots TBC"],
          contentHash: null,
        }),
      ],
      REGISTRE,
    );
    const casse = c.filter((x) => x.kind === "BROKEN_REFERENCE");
    expect(casse).toHaveLength(1);
    expect(casse[0].field).toBe("SRC-404");
  });

  it("un trou dans la suite de versions est constaté", () => {
    // Versions 1 et 3 sans 2 : une révision a été retirée. C'est le contraire
    // de l'immuabilité, et ça ne se voit pas autrement.
    const c = auditClaims(
      [auditable({ version: 1 }), auditable({ version: 3 })],
      REGISTRE,
    );
    expect(c.filter((x) => x.kind === "VERSION_GAP")).toHaveLength(1);
    expect(c.find((x) => x.kind === "VERSION_GAP")?.version).toBe(2);
  });

  it("une version en double est constatée", () => {
    const c = auditClaims([auditable({ version: 1 }), auditable({ version: 1 })], REGISTRE);
    expect(c.some((x) => x.kind === "DUPLICATE_VERSION")).toBe(true);
  });

  it("un constat nomme un claim et un CHAMP — jamais un contenu", () => {
    const c = auditClaims(
      [auditable({ title: "Titre confidentiel réécrit", contentHash: "0".repeat(64) })],
      REGISTRE,
    );
    expect(c).toHaveLength(1);
    expect(Object.keys(c[0]).sort()).toEqual(["claimId", "field", "kind", "version"]);
    expect(JSON.stringify(c)).not.toContain("Titre confidentiel");
  });

  it("le résumé compte par type, sans rien republier", () => {
    const r = summarizeFindings(auditClaims([auditable({ contentHash: null })], REGISTRE));
    expect(r.UNSEALED).toBe(1);
    expect(r.CONTENT_MUTATED).toBe(0);
    expect(r.BROKEN_REFERENCE).toBe(0);
  });
});

// ═══ Les séparateurs ne sont jamais posés en octets bruts ════════════════

describe("ÉTAPE 6 — aucun caractère de contrôle littéral dans le source", () => {
  // Défaut commis puis mesuré ici même : les trois séparateurs du sceau
  // (U+0000, U+001E, U+001F) avaient été écrits en OCTETS BRUTS. Le fichier
  // ressortait en `data` pour `file`, grep le traitait en binaire et se
  // taisait, git l'aurait diffé comme un binaire. Invisible à la lecture,
  // et invisible à la revue — la pire combinaison.
  //
  // Les valeurs n'ont pas changé, seule leur ÉCRITURE : `" "`. Ce test
  // ferme la classe entière plutôt que l'instance.
  const SOURCES = [
    "src/lib/casefile/versioning.ts",
    "src/lib/casefile/integrityAudit.ts",
    "src/lib/casefile/canonicalReader.ts",
    "src/lib/casefile/publicProjection.ts",
    "src/lib/casefile/publicationState.ts",
  ];

  it("les sources du module restent du TEXTE", () => {
    for (const p of SOURCES) {
      const octets = readFileSync(p);
      const controle = new Set<number>();
      for (const c of octets) if (c < 9 || (c > 13 && c < 32)) controle.add(c);
      expect([...controle], `${p} porte des octets de contrôle`).toEqual([]);
    }
  });

  it("les séparateurs du sceau sont déclarés en échappées lisibles", () => {
    const code = codeSeul("src/lib/casefile/versioning.ts");
    expect(code).toContain('"\\u0000"');
    expect(code).toContain('"\\u001f"');
    expect(code).toContain('"\\u001e"');
  });
});

// ═══ La frontière entre les deux lecteurs ════════════════════════════════

describe("ÉTAPE 6 — l'audit lit l'interne, le lecteur public ne le peut pas", () => {
  it("le lecteur public ne sélectionne toujours aucun identifiant de ligne", () => {
    const code = codeSeul("src/lib/casefile/canonicalReader.ts");
    const listes = [...code.matchAll(/SELECT\s+([\s\S]*?)\s+FROM/gi)].map((m) => m[1]);
    for (const liste of listes) {
      for (const f of ["contentHash", "supersedes", "localFilePath", "sessionId"]) {
        expect(liste, f).not.toContain(f);
      }
    }
  });

  it("l'audit, lui, lit le sceau — et ne rend que des constats", () => {
    const code = codeSeul("src/lib/casefile/integrityAudit.ts");
    expect(code).toContain('"contentHash"');
    expect(code).not.toMatch(/SELECT\s+\*/i);
    // Ce qui sort est un rapport de constats, pas un dossier.
    expect(code).toContain("constats");
    expect(code).not.toContain("PublicClaim");
  });
});
