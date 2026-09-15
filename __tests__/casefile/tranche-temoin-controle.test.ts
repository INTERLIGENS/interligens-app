/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-214 · LA TRANCHE TÉMOIN — CE QU'ELLE NE PEUT PAS FAIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ██  « Le gate doit être mesuré satisfait. Il ne doit pas être franchi. »   ██
 *
 * La tranche verticale traverse jusqu'au contrat de PUBLICATION et s'arrête là.
 * Ce fichier tient la frontière — et il la tient STRUCTURELLEMENT, parce qu'un
 * script qui « ne publie pas » par discipline publierait le jour où quelqu'un
 * ajoute trois lignes sans y penser.
 *
 * ─── L'EXCLUSION N'EST PAS UNE CONVENTION, ET C'EST LE CŒUR ──────────────
 *
 * Le témoin est exclu par `token_casefiles.publishStatus`, lu par l'autorité
 * FERMÉE `publicationAuthority.decidePublication` — la règle de publication du
 * dépôt, écrite à UN endroit et consommée par toutes les surfaces publiques
 * (garde existante : `__tests__/casefile/s1-autorite-unique.test.ts`, qui
 * refuse toute surface qui réécrirait la règle ; non redoublée ici).
 *
 * ⛔ CE QUE CE FICHIER AJOUTE, ET QUE RIEN NE COUVRAIT : l'exclusion ne doit
 *    PAS venir de l'IDENTITÉ du témoin. `ref.ts` l'interdit — « encoder est
 *    permis, interpréter est interdit » — et une exclusion par cas particulier
 *    serait exactement l'exclusion « par convention » qu'on refuse : elle
 *    protégerait CE dossier, et aucun autre.
 *
 *    Les témoins (B) vérifient donc que NI l'autorité, NI la projection, NI la
 *    carte d'identité par mint ne connaissent le témoin par son nom.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decidePublication, PUBLISHED_STATUS, keepPublishable } from "@/lib/casefile/publicationAuthority";
import { canonicalRefForMint } from "@/lib/casefile/publicProjection";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const TRANCHE = "src/scripts/casefile/tranche-temoin-controle.ts";
const REF_TEMOIN = "IL-RC-CONTROLLED-WITNESS-001";
const MINT_SENTINEL = "RC-CONTROLLED-WITNESS-NOT-A-MINT";

// ═══════════════════════════════════════════════════════════════════════════
describe("A · la tranche ne PEUT pas publier", () => {
  const code = () => sansCommentaires(lire(TRANCHE));

  it("aucun verbe de libération n'est IMPORTÉ", () => {
    // Pas « n'est pas appelé » : n'est pas IMPORTÉ. Une capacité absente du
    // module ne peut pas être invoquée par distraction.
    for (const verbe of ["executeRelease", "executeRevoke", "decidePublicRelease", "attestPersistedDecision"]) {
      expect(code(), `la tranche importe ${verbe}`).not.toContain(verbe);
    }
  });

  it("aucune écriture d'état PUBLIC, ni de décision de publication", () => {
    const c = code();
    expect(c).not.toMatch(/state\s*=\s*['"`]PUBLIC/);
    expect(c).not.toContain("casefile_claim_publication_decisions");
    expect(c).not.toMatch(/INSERT INTO casefile_claim/);
    expect(c).not.toMatch(/publishStatus:\s*['"`]published/);
    // ⚠️ Pas de garde sur le MOT « GRANT » : la tranche l'écrit dans un message
    // (« 0 GRANT »), et une garde qui punit le compte rendu d'une absence
    // pousse à cesser de rendre compte. Ce qui est gardé est la CAPACITÉ —
    // aucun verbe importé, aucune écriture dans la table des décisions.
  });

  it("`isPublic` n'est écrit qu'en FAUX, et en dur", () => {
    const c = code();
    const poses = c.match(/"isPublic"[^,)]*|isPublic:\s*\w+/g) ?? [];
    expect(poses.length).toBeGreaterThan(0);
    expect(c).not.toMatch(/isPublic[^,)\n]*\btrue\b/);
    // La colonne est posée par un littéral `false` dans le VALUES, pas par un
    // paramètre : un appelant n'a aucun levier dessus.
    expect(c).toMatch(/VALUES[\s\S]*\bfalse\b/);
  });

  it("la tranche ne POSE aucun statut : elle hérite du défaut et le CONSTATE", () => {
    const c = code();
    // ⛔ LE POINT : aucun littéral de statut nulle part. Le dossier témoin ne
    //    CHOISIT pas d'être exclu — il hérite du DEFAULT de la colonne, et la
    //    tranche demande ensuite à l'autorité si cette ligne est publiable.
    //    Poser « draft » aurait fait de l'exclusion une décision du script.
    expect(c).not.toMatch(/publishStatus:\s*["'`]/);
    expect(c).not.toMatch(/["'`]draft["'`]/);
    // Ce qu'elle fait à la place : elle CONSULTE, sur la ligne créée.
    expect(c).toContain("decidePublication(dossier)");
    // La charge de mise à jour est VIDE — un dossier témoin déjà présent n'est
    // réécrit en RIEN : un run futur ne peut ni le publier, ni le « remettre »
    // en brouillon. Et elle traverse quand même la frontière RC-2, AU SITE
    // D'APPEL : la propriété doit être lisible là où l'écriture a lieu, pas
    // déduite du fait que la charge est vide aujourd'hui.
    expect(c).toMatch(/update:\s*withoutRef\(\s*\{\s*\}\s*\)/);
    // Et la création passe par le SIÈGE de l'assignation, au site d'appel.
    expect(c).toMatch(/create:\s*assignRef\(/);
  });

  it("aucun dossier existant n'est nommé — ni VINE, ni BOTIFY, ni LAB, ni CBEX", () => {
    // LE CODE, PAS LA PROSE : l'en-tête DIT qu'il ne touche ni VINE ni BOTIFY,
    // et c'est exactement ce qu'on veut lire dans un en-tête.
    const c = code();
    for (const autre of ["VINE", "BOTIFY", "IL-PND-LAB", "IL-PON-CBEX", "IL-SHILL-"]) {
      expect(c, `la tranche nomme ${autre}`).not.toContain(autre);
    }
  });

  it("la tranche n'exécute AUCUN DDL", () => {
    const c = sansCommentaires(lire(TRANCHE));
    for (const verbe of [/\bCREATE\s+TABLE\b/i, /\bALTER\s+TABLE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i]) {
      expect(c, `DDL interdit : ${verbe}`).not.toMatch(verbe);
    }
    // Et elle ne met à jour ni ne supprime aucune ligne en SQL brut.
    expect(c).not.toMatch(/\bUPDATE\s+"?[A-Za-z_]/);
    expect(c).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("aucun des scripts de rattrapage interdits n'est atteint", () => {
    const c = lire(TRANCHE);
    for (const s of ["backfill-evidence", "migrate-snapshots", "recover-snapshots-d"]) {
      expect(c, `la tranche atteint ${s}`).not.toContain(s);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("B · l'exclusion est STRUCTURELLE, pas nominative", () => {
  it("l'autorité de publication ne connaît le témoin par AUCUN nom", () => {
    // Si elle le connaissait, elle protégerait CE dossier et aucun autre —
    // c'est la définition d'une exclusion par convention.
    for (const f of [
      "src/lib/casefile/publicationAuthority.ts",
      "src/lib/casefile/publicProjection.ts",
      "src/lib/casefile/canonicalReader.ts",
    ]) {
      const src = lire(f);
      for (const nom of [REF_TEMOIN, MINT_SENTINEL, "RC-CONTROLLED-WITNESS", "RCWITNESS"]) {
        expect(src, `${f} connaît « ${nom} »`).not.toContain(nom);
      }
    }
  });

  it("l'exclusion ne lit AUCUN segment de la référence — `ref.ts` l'interdit", () => {
    const src = sansCommentaires(lire("src/lib/casefile/publicationAuthority.ts"));
    // La primitive ne voit qu'un champ : `publishStatus`. Elle ne découpe rien,
    // ne préfixe rien, ne connaît même pas l'existence d'un `ref`.
    expect(src).not.toContain("ref");
    expect(src).not.toMatch(/\.split\(|startsWith\(|includes\(/);
  });

  it("`draft` est REFUSÉ, et `published` est la SEULE valeur qui publie", () => {
    expect(decidePublication({ publishStatus: "draft" })).toEqual({
      decision: "REFUSED",
      cause: "NOT_PUBLISHED",
    });
    // Fail-closed sur toute forme approchante : le témoin ne sortira pas par
    // une faute de frappe favorable.
    for (const v of ["Draft", "PUBLISHED", " published ", "Published", "", "   ", null, undefined, 1, true]) {
      const d = decidePublication({ publishStatus: v });
      expect(d.decision, `« ${String(v)} » ne doit pas publier`).toBe("REFUSED");
    }
    expect(decidePublication({ publishStatus: PUBLISHED_STATUS }).decision).toBe("PUBLISHABLE");
  });

  it("un index qui filtre par l'autorité laisse le témoin DEHORS", () => {
    // La forme « liste » de la primitive, telle que les deux index publics
    // l'emploient. Le témoin n'y entre pas, et LAB y entre.
    const rows = [
      { ref: REF_TEMOIN, publishStatus: "draft" },
      { ref: "IL-PND-LAB-001", publishStatus: "published" },
    ];
    expect(keepPublishable(rows).map((r) => r.ref)).toEqual(["IL-PND-LAB-001"]);
  });

  it("la carte d'identité par mint ne peut pas NOMMER le témoin", () => {
    // La seconde exclusion, INDÉPENDANTE de la première : les surfaces par mint
    // (PDF retail) résolvent par une carte FERMÉE. Le sentinel n'y est pas, et
    // il ne peut pas y être — ce n'est pas une adresse.
    expect(canonicalRefForMint(MINT_SENTINEL)).toBeNull();
    expect(canonicalRefForMint(REF_TEMOIN)).toBeNull();
    const projection = lire("src/lib/casefile/publicProjection.ts");
    const carte = projection.slice(
      projection.indexOf("CANONICAL_REF_BY_MINT"),
      projection.indexOf("export function canonicalRefForMint"),
    );
    expect(carte).not.toContain("RC-CONTROLLED");
  });
});
