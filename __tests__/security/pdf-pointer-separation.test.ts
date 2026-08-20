// __tests__/security/pdf-pointer-separation.test.ts
//
// A2 — LA DISCRIMINATION QUI DÉBLOQUE A4.
//
// engine.ts écrivait l'archive datée (immuable) ET le pointeur `latest.pdf`
// (mutable) sous le MÊME préfixe `reports/`. Deux propriétés y sont
// contradictoires :
//
//   · l'archive datée ne doit PAS pouvoir être supprimée (conservation) ;
//   · le pointeur DOIT pouvoir être réécrit (chaque génération le remplace).
//
// Un Bucket Lock R2 est prefix-scoped et bloque À LA FOIS la suppression ET le
// remplacement (mesuré en documentation : `ObjectLockedByBucketPolicy`, 403,
// sur delete et sur re-PUT). Donc sous un préfixe unique, verrouiller pour
// protéger l'archive verrouille aussi le pointeur — le second PUT de la
// génération suivante rendrait 403, et /api/pdf/{handle} servirait à jamais la
// version gelée.
//
// A2 sépare les préfixes : archive sous `reports/`, pointeur sous `pointers/`.
// Ce test le prouve sur des OBJETS SYNTHÉTIQUES — jamais la production — avec
// un faux S3 qui modélise la sémantique prefix-scoped du verrou. Il ne pose
// aucun vrai Bucket Lock (c'est A4) ; il modélise ses règles pour montrer que
// la séparation des préfixes est ce qui rend les deux propriétés compatibles.
//
// ── LA LEÇON DES CONTRÔLES PRÉCÉDENTS ─────────────────────────────────────
// Pas seulement un test de verdict. On assert l'ÉTAT du magasin après chaque
// opération (contenu, existence), et on démontre le cas contradictoire sous
// préfixe unique — pas seulement le cas heureux sous préfixes séparés.

import { describe, it, expect } from "vitest";
import { pointerLatestKey, POINTER_PREFIX } from "@/lib/storage/pdfStorage";

// ── Un faux S3 qui modélise un Bucket Lock prefix-scoped ──────────────────
//
// Règles, calquées sur la doc R2 (bucket-locks) :
//   · une règle de verrou couvre un PRÉFIXE ;
//   · sur un objet dont la clé commence par ce préfixe : DELETE → 403,
//     et re-PUT (overwrite d'une clé existante) → 403 ;
//   · un premier PUT (clé neuve) reste permis, comme en production.
class LockedError extends Error {
  constructor(key: string) {
    super(`ObjectLockedByBucketPolicy: ${key}`);
    this.name = "ObjectLockedByBucketPolicy";
  }
}

class FakeR2 {
  private store = new Map<string, string>();
  private lockPrefixes: string[] = [];

  /** A4 posera ceci en vrai ; ici on le modélise. */
  lockPrefix(prefix: string): void {
    this.lockPrefixes.push(prefix);
  }

  private isLocked(key: string): boolean {
    return this.lockPrefixes.some((p) => key.startsWith(p));
  }

  put(key: string, body: string): void {
    // Re-PUT sur une clé existante SOUS verrou → refus (overwrite bloqué).
    if (this.store.has(key) && this.isLocked(key)) throw new LockedError(key);
    this.store.set(key, body);
  }

  delete(key: string): void {
    if (this.isLocked(key)) throw new LockedError(key);
    this.store.delete(key);
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

const HANDLE = "SYNTHETIQUE_ravedao";
const archiveKey = (ts: string) => `reports/${HANDLE}/CASE_${HANDLE}_${ts}.pdf`;

// ── D'abord : la clé produite par le code réel est bien HORS de reports/ ───

describe("A2 · la clé du pointeur, telle que le code la produit", () => {
  it("pointerLatestKey vit sous `pointers/`, jamais sous `reports/` ni `evidence/`", () => {
    const k = pointerLatestKey(HANDLE);
    expect(k).toBe(`pointers/${HANDLE}/latest.pdf`);
    expect(k.startsWith("pointers/")).toBe(true);
    expect(k.startsWith("reports/")).toBe(false);
    expect(k.startsWith("evidence/")).toBe(false);
    expect(POINTER_PREFIX).toBe("pointers");
  });

  it("l'écrivain et le lecteur partagent CETTE fonction — pas deux littéraux", async () => {
    // engine.ts et route.ts importent tous deux pointerLatestKey. Si l'un
    // divergeait, ce serait un 404 silencieux. On vérifie que la source de
    // vérité est bien une fonction unique, pas une chaîne recopiée.
    const engine = await import("node:fs").then((fs) =>
      fs.readFileSync(process.cwd() + "/src/lib/pdf/engine.ts", "utf8"),
    );
    const route = await import("node:fs").then((fs) =>
      fs.readFileSync(process.cwd() + "/src/app/api/pdf/[handle]/route.ts", "utf8"),
    );
    expect(engine).toContain("pointerLatestKey(handle)");
    expect(route).toContain("pointerLatestKey(handle)");
    // Et surtout : plus aucune construction en dur `reports/${handle}/latest.pdf`.
    expect(engine).not.toMatch(/reports\/\$\{handle\}\/latest\.pdf/);
    expect(route).not.toMatch(/reports\/\$\{handle\}\/latest\.pdf/);
  });
});

// ── C3 — les deux propriétés, désormais séparées ──────────────────────────

describe("A2 · C3 — pointeur mutable ET archive immuable, sous préfixes séparés", () => {
  it("le pointeur `pointers/` se laisse RÉÉCRIRE, même quand `reports/` est verrouillé", () => {
    const r2 = new FakeR2();
    const pk = pointerLatestKey(HANDLE);

    // Génération 1 : archive + pointeur.
    r2.put(archiveKey("2026-08-20T04-00-00"), "pdf-v1");
    r2.put(pk, "pdf-v1");

    // A4 pose le verrou de conservation sur reports/.
    r2.lockPrefix("reports/");

    // Génération 2 : nouvelle archive (clé neuve, permise) + RÉÉCRITURE du pointeur.
    r2.put(archiveKey("2026-08-21T04-00-00"), "pdf-v2");
    expect(() => r2.put(pk, "pdf-v2")).not.toThrow(); // ⟵ le PUT ne 403 pas

    // Le pointeur porte bien la dernière version.
    expect(r2.get(pk)).toBe("pdf-v2");
  });

  it("l'archive datée, sous verrou, ne se laisse PAS supprimer", () => {
    const r2 = new FakeR2();
    const ak = archiveKey("2026-08-20T04-00-00");
    r2.put(ak, "pdf-v1");
    r2.lockPrefix("reports/");

    expect(() => r2.delete(ak)).toThrow("ObjectLockedByBucketPolicy");
    expect(r2.has(ak)).toBe(true); // toujours là
  });

  it("les deux ensemble : on réécrit le pointeur ET on échoue à effacer l'archive, dans le même magasin verrouillé", () => {
    const r2 = new FakeR2();
    const pk = pointerLatestKey(HANDLE);
    const ak = archiveKey("2026-08-20T04-00-00");
    r2.put(ak, "pdf-v1");
    r2.put(pk, "pdf-v1");
    r2.lockPrefix("reports/");

    r2.put(pk, "pdf-v2"); // mutable — OK
    expect(() => r2.delete(ak)).toThrow(); // immuable — refusé

    expect(r2.get(pk)).toBe("pdf-v2");
    expect(r2.get(ak)).toBe("pdf-v1");
  });
});

// ── La preuve que la SÉPARATION est nécessaire : le cas contradictoire ─────

describe("A2 · pourquoi la séparation était obligatoire — le cas sous préfixe UNIQUE", () => {
  it("si le pointeur vivait ENCORE sous `reports/`, le verrou 403 sa réécriture", () => {
    const r2 = new FakeR2();
    // L'ANCIENNE clé, celle d'avant A2.
    const ancienPointeur = `reports/${HANDLE}/latest.pdf`;

    r2.put(archiveKey("2026-08-20T04-00-00"), "pdf-v1");
    r2.put(ancienPointeur, "pdf-v1");
    r2.lockPrefix("reports/");

    // La génération suivante voudrait réécrire le pointeur — et échoue.
    expect(() => r2.put(ancienPointeur, "pdf-v2")).toThrow("ObjectLockedByBucketPolicy");

    // Conséquence en production : /api/pdf/{handle} continuerait de servir v1,
    // pour toujours, en silence. C'est le défaut qu'A2 supprime.
    expect(r2.get(ancienPointeur)).toBe("pdf-v1");
  });

  it("le contraste tient au SEUL préfixe : même magasin, même verrou, deux issues", () => {
    const r2 = new FakeR2();
    r2.lockPrefix("reports/");
    r2.put("reports/x/CASE_x_2026.pdf", "archive"); // clé neuve, permise
    r2.put(pointerLatestKey("x"), "pointeur-v1"); // hors verrou

    // pointers/ : réécriture OK. reports/ : réécriture refusée.
    expect(() => r2.put(pointerLatestKey("x"), "pointeur-v2")).not.toThrow();
    expect(() => r2.put("reports/x/CASE_x_2026.pdf", "archive-bis")).toThrow();
  });
});
