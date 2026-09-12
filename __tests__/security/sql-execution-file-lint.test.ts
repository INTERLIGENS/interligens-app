// __tests__/security/sql-execution-file-lint.test.ts
//
// LE CONTRÔLE QUI MANQUAIT À TOUTE LA MÉTHODE.
//
// Le 2026-08-19, `docs/prep/EXECUTION_2026-08-19.sql` a été relu ligne à ligne,
// ses colonnes comparées caractère par caractère au schéma, ses garde-fous
// vérifiés, ses 32 lignes comptées, ses empreintes dédupliquées — et il ne se
// parsait pas :
//
//     ERROR: syntax error at or near "ON" (SQLSTATE 42601)
//
// Une virgule orpheline, résidu du retrait de deux lignes `VALUES` dont l'une
// était la dernière du lot. **Aucune de nos vérifications ne pouvait l'attraper**
// : toutes portaient sur le SENS du fichier, aucune sur sa GRAMMAIRE.
//
// ── CE QUE CE FICHIER N'EST PAS ────────────────────────────────────────────
//
// Ce n'est PAS un parseur SQL, et il ne faut pas le lire comme tel. Aucun
// parseur Postgres hors ligne n'existe sur cette machine — mesuré le
// 2026-08-19 : ni `psql`, ni `postgres`, ni `pgsanity`, ni Docker, ni
// `libpg_query`/`pgsql-parser` dans `node_modules`, ni `sqlparse`/`pglast` côté
// Python. `sqlite3` est présent mais c'est un faux ami : il rejetterait `DO $$`,
// `::text`, `TIMESTAMP(3)` et `gen_random_uuid()`, qui sont du Postgres valide.
//
// Le seul vrai parseur utilisable serait `@libpg-query/parser` — le parseur de
// Postgres lui-même, compilé en WASM, qui tourne hors connexion une fois
// installé. L'installer touche `package.json`, chemin GELÉ : c'est une fenêtre
// d'exemption et une décision, pas une retouche. Tant qu'elle n'est pas prise,
// la parade est ci-dessous.
//
// ── CE QUE C'EST ───────────────────────────────────────────────────────────
//
// Un contrôle STRUCTUREL, volontairement borné à des invariants qu'on peut
// vérifier sans grammaire — et qui couvrent la famille de fautes que produit
// notre façon de travailler : générer un fichier par script, puis en retirer
// des lignes à la main.
//
// Il attrape la virgule orpheline. Il ne prétend pas attraper le reste.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FICHIERS = fs
  .readdirSync(path.join(process.cwd(), "docs/prep"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => path.join("docs/prep", f));

/** Retire commentaires de ligne et chaînes quotées : une virgule dans un texte
 *  n'est pas une virgule de syntaxe, et `--` dans une chaîne n'est pas un
 *  commentaire. Sans ce nettoyage, le contrôle crierait au loup sur les notes
 *  de chaîne de conservation, qui sont pleines de virgules et d'apostrophes. */
function dépouiller(sql: string): string[] {
  return sql.split("\n").map((ligne) => {
    let sortie = "";
    let dansChaine = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (dansChaine) {
        if (c === "'") {
          if (ligne[i + 1] === "'") i++; // '' échappée
          else dansChaine = false;
        }
        continue;
      }
      // Une chaîne devient un JETON, elle ne DISPARAÎT pas : une ligne qui ne
      // contient qu'un littéral (`'person:...'`) resterait sinon vide, et le
      // contrôle de virgule sauterait par-dessus comme si elle n'existait pas.
      // C'est la même famille de faute que celle qu'on traque — une
      // transformation qui efface en silence.
      if (c === "'") { dansChaine = true; sortie += "§"; continue; }
      if (c === "-" && ligne[i + 1] === "-") break; // commentaire de ligne
      sortie += c;
    }
    return sortie;
  });
}

describe("fichiers SQL de docs/prep — contrôles structurels", () => {
  it("il y a bien des fichiers à contrôler", () => {
    expect(FICHIERS.length).toBeGreaterThan(0);
  });

  for (const f of FICHIERS) {
    describe(f, () => {
      const brut = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      const lignes = dépouiller(brut);
      const code = lignes.join("\n");

      // ── LE CONTRÔLE QUI NOUS A MANQUÉ ────────────────────────────────────
      it("aucune virgule orpheline avant un mot-clé ou un point-virgule", () => {
        // Une virgule en fin de ligne doit être suivie d'un autre élément de
        // liste — jamais de la fin de l'instruction. C'est exactement la faute
        // que produit le retrait de la DERNIÈRE ligne d'un VALUES.
        const CLÉS = /^\s*(ON\s+CONFLICT|RETURNING|FROM|WHERE|ORDER\s+BY|GROUP\s+BY|LIMIT|COMMIT|ROLLBACK|END|\)\s*;?)\b/i;
        const fautes: string[] = [];
        for (let i = 0; i < lignes.length; i++) {
          if (!lignes[i].trimEnd().endsWith(",")) continue;
          // prochaine ligne non vide
          let j = i + 1;
          while (j < lignes.length && lignes[j].trim() === "") j++;
          if (j >= lignes.length) { fautes.push(`${i + 1} : virgule en fin de fichier`); continue; }
          if (CLÉS.test(lignes[j]) || lignes[j].trim().startsWith(";")) {
            fautes.push(`ligne ${i + 1} → suivie de « ${lignes[j].trim().slice(0, 40)} » (ligne ${j + 1})`);
          }
        }
        expect(fautes, `virgule(s) orpheline(s) :\n  ${fautes.join("\n  ")}`).toEqual([]);
      });

      it("BEGIN et COMMIT s'équilibrent", () => {
        const b = (code.match(/^\s*BEGIN\s*;/gim) ?? []).length;
        const c = (code.match(/^\s*COMMIT\s*;/gim) ?? []).length;
        expect(b, `BEGIN=${b} COMMIT=${c}`).toBe(c);
      });

      it("les guillemets-dollar $$ s'équilibrent", () => {
        // `DO $$ … END $$;` — un $$ non refermé avale tout le reste du fichier
        // sans qu'aucun compte de lignes ne s'en aperçoive.
        expect((brut.match(/\$\$/g) ?? []).length % 2, "nombre impair de $$").toBe(0);
      });

      it("les parenthèses s'équilibrent sur l'ensemble du code", () => {
        let n = 0;
        for (const c of code) { if (c === "(") n++; else if (c === ")") n--; }
        expect(n, n > 0 ? `${n} parenthèse(s) non refermée(s)` : `${-n} parenthèse(s) en trop`).toBe(0);
      });

      it("aucune instruction destructrice hors commentaire", () => {
        // Le fichier d'exécution ne contient qu'un seul DROP, documenté, et
        // aucun DELETE/TRUNCATE. Le contrôle vit ici pour qu'un ajout futur
        // le réveille.
        expect((code.match(/\bDELETE\s+FROM\b/gi) ?? []).length).toBe(0);
        expect((code.match(/\bTRUNCATE\b/gi) ?? []).length).toBe(0);
        expect((code.match(/\bDROP\s+TABLE\b/gi) ?? []).length).toBe(0);
      });
    });
  }
});

// ── L'INVARIANT QUI RELIE LE COMPTE AU GARDE-FOU ──────────────────────────
//
// Le second défaut du jour : le fichier a porté « 34 » dans son titre et son
// commentaire de contrôle alors que son garde-fou attendait 32. Un compte et
// son garde-fou qui divergent, c'est la même famille de faute que la virgule —
// une modification faite à un endroit, pas à l'autre.
describe("EXECUTION_2026-08-19.sql — le compte et son garde-fou disent la même chose", () => {
  const f = "docs/prep/EXECUTION_2026-08-19.sql";
  const brut = fs.readFileSync(path.join(process.cwd(), f), "utf8");

  it("le nombre de lignes VALUES égale le nombre attendu par le garde-fou", () => {
    const lignesValues = brut.split("\n").filter((l) => l.startsWith("  ('evi_rep_")).length;
    const m = brut.match(/IF n <> (\d+) THEN RAISE EXCEPTION 'Attendu (\d+) pieces/);
    expect(m, "garde-fou de comptage introuvable").not.toBeNull();
    const attenduIf = Number(m![1]);
    const attenduMsg = Number(m![2]);

    expect(attenduIf, "le test et son message d'erreur ne disent pas le même nombre").toBe(attenduMsg);
    expect(lignesValues, `${lignesValues} lignes VALUES contre un garde-fou à ${attenduIf}`).toBe(attenduIf);
  });

  it("aucune empreinte sha256 en double parmi les lignes versées", () => {
    // `EvidenceItem.sha256` est @unique : un doublon fait échouer la
    // transaction ENTIÈRE, pas la ligne. Et `ON CONFLICT (id)` ne protège pas —
    // le conflit est sur sha256, pas sur id.
    const shas: string[] = brut.split("\n").filter((l) => l.startsWith("  ('evi_rep_")).join("\n")
      .match(/'[0-9a-f]{64}'/g) ?? [];
    const doublons = shas.filter((s, i) => shas.indexOf(s) !== i);
    expect(doublons, `sha256 en double : ${[...new Set(doublons)].join(", ")}`).toEqual([]);
    expect(shas.length).toBe(new Set(shas).size);
  });
});
