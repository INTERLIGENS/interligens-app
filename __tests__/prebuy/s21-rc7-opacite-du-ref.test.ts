// ─── BUILD 12 · S21 — RC-7 : LE REF EST OPAQUE, ET ÇA SE DÉMONTRE ────────
//
// ██  RC-7 · aucun consommateur ne lit de sémantique forensique dans les   ██
// ██          segments d'un ref de dossier                                 ██
//
// La règle ratifiée :
//
//   « Existing dossier.ref values = GRANDFATHERED OPAQUE CASEFILE
//     IDENTIFIERS. They are preserved. Their embedded mnemonics carry ZERO
//     forensic semantic authority. »
//
// Ce que cette règle change pour le corpus : S19 avait mesuré TROIS
// conventions de segment mutuellement incompatibles et l'avait porté au
// débit du point SEGMENTS. La règle d'opacité ne corrige pas ces conventions,
// elle les DISSOUT — elles cessent d'être un défaut parce qu'elles cessent de
// signifier. Ce qui reste à garder n'est donc pas leur cohérence : c'est que
// personne ne s'y fie.
//
// ─── LA GARDE NE CHERCHE PAS « IL- » ────────────────────────────────────
//
// Chercher le préfixe serait chercher la FORME, et une garde de forme ne
// protège que des valeurs qu'elle connaît déjà. Ce qui est interdit n'est pas
// une orthographe, c'est une CAPACITÉ : dériver une propriété du CONTENU d'un
// ref — un split, un slice, un startsWith, un match, une carte indexée par
// fragment, un test d'appartenance à une famille, une comparaison partielle.
//
// La garde cherche donc l'opération, sur l'univers des modules qui manipulent
// réellement une référence de dossier — et cet univers est DÉCOUVERT, jamais
// énuméré : les ancres sont les exports de la couche d'autorité, lus dans les
// fichiers eux-mêmes, et les consommateurs sont ceux qui les importent.
//
// ─── LE PIÈGE ÉVITÉ : DEUX ESPACES QUI PORTENT LE MÊME MOT ──────────────
//
// « caseId » désigne au moins deux choses sans rapport dans ce dépôt :
//
//   · la référence d'un dossier CaseFile — le sujet de RC-7
//   · l'identifiant de ligne d'un dossier d'investigateur, un id de base,
//     dont `…/cases/[caseId]/exports/route.ts` prend les 8 premiers
//     caractères pour composer un nom de fichier court
//
// Le second n'est PAS un ref de dossier, et une garde qui le compterait
// produirait un rouge sur un code irréprochable. C'est la raison pour
// laquelle l'univers est découvert par IMPORT de la couche d'autorité et non
// par nom de variable : les fichiers d'investigateurs n'en importent rien, et
// sortent d'eux-mêmes du périmètre.
//
// ─── ET SI RC-7 DEVIENT UN TYPE ─────────────────────────────────────────
//
// T1 propose que la lecture d'un ref rende un type opaque marqué, ce qui
// ferait de RC-7 un coût de type plutôt qu'une garde. Cette garde reste utile
// sous cette forme, et pour une raison précise : UN TYPE SE CONTOURNE PAR UN
// CAST. Un `as string` suivi d'un `.split(` est invisible au compilateur et
// parfaitement visible ici. Elle est le filet sous le type, pas son doublon.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// A · SÉMANTIQUE NULLE — démontrée sur les CINQ valeurs réelles
// ═══════════════════════════════════════════════════════════════════════════
//
// RC-7 ne se prouve pas en disant « les segments ne signifient rien ». Ça se
// DÉMONTRE, et la forme qui le démontre est celle qu'on a retenue en AG3 :
// encoder le désaccord entre DEUX CRITÈRES RIVAUX sur le même sujet mesuré.
//
//   critère 1   la famille GOUVERNÉE — la colonne, écrite par une autorité
//   critère 2   la famille DEVINÉE — le deuxième segment du ref
//
// Si les deux s'accordaient partout, l'opacité serait une convention polie.
// Ils ne s'accordent pas, et c'est la démonstration.

/**
 * Les cinq refs réels, avec leur famille GOUVERNÉE telle que le dépôt la
 * pose. Chaque valeur est fondée sur une source, citée — aucune n'est
 * supposée, aucune n'est lue en base (je n'y ai pas accès, et fabriquer la
 * mesure serait pire que ne pas l'avoir).
 */
const REFS_REELS = [
  {
    ref: "IL-SHILL-BOTIFY-001",
    // docs/prep/patches/BUILD9/04_migration_38.sql:28
    familleGouvernee: "SHILL",
  },
  {
    ref: "IL-SHILL-VINE-001",
    // docs/prep/patches/BUILD9/04_migration_38.sql:37
    familleGouvernee: "SHILL",
  },
  {
    ref: "IL-PND-LAB-001",
    // prisma/seed-lab.ts:376
    familleGouvernee: "pump_and_dump",
  },
  {
    ref: "IL-PON-CBEX-001",
    // prisma/seed-cbex.ts:224 — et la ligne vit dans une AUTRE TABLE
    // (`PlatformCaseFile`). Le nommage traverse deux tables ; un
    // consommateur qui déduirait la table du segment se tromperait aussi.
    familleGouvernee: "platform_fraud",
  },
  {
    ref: "IL-CONC-BLACKBULL-001",
    // AUCUNE SOURCE. La ligne préexiste au dépôt : ni seed, ni INSERT, ni
    // script ne la crée, et le seul fichier qui la nomme la LIT. GPT a acté
    // que son origine est inconnue et que la valeur est conservée telle
    // quelle. `null` DIT cette inconnue au lieu de la combler.
    familleGouvernee: null,
  },
] as const;

/**
 * LE CONSOMMATEUR NAÏF — celui que RC-7 interdit.
 *
 * Il est écrit ici pour être RÉFUTÉ, jamais pour être utilisé : c'est le même
 * geste que la clé de route synthétique de `tokenIdentity.ts`, présente pour
 * être reconnue et refusée. Le tenir sous la main permet de mesurer ce qu'il
 * coûterait au lieu de l'affirmer.
 */
const familleDevinee = (ref: string): string | null => ref.split("-")[1] ?? null;

describe("S21/a — les segments ne portent AUCUNE autorité, et ça se mesure", () => {
  it("le critère deviné CONTREDIT le critère gouverné — au moins une fois", () => {
    const desaccords = REFS_REELS.filter(
      (r) => r.familleGouvernee !== null && familleDevinee(r.ref) !== r.familleGouvernee,
    );
    // PND ≠ pump_and_dump · PON ≠ platform_fraud. Deux désaccords sur quatre
    // valeurs décidables — et il suffirait d'UN pour que la règle tombe : un
    // critère qui se trompe une fois n'est pas un critère, c'est une
    // coïncidence sur le reste.
    expect(
      desaccords.map((d) => `${d.ref} → deviné « ${familleDevinee(d.ref)} », gouverné « ${d.familleGouvernee} »`),
    ).toHaveLength(2);
  });

  it("et il n'est même pas TOTAL — une valeur réelle n'a pas de famille du tout", () => {
    const indecidables = REFS_REELS.filter((r) => r.familleGouvernee === null);
    expect(indecidables.map((r) => r.ref)).toEqual(["IL-CONC-BLACKBULL-001"]);
    // Le segment, lui, rend quelque chose. C'est exactement le danger : la
    // devinette RÉPOND là où l'autorité se tait, et sa réponse a l'air d'une
    // mesure.
    expect(familleDevinee("IL-CONC-BLACKBULL-001")).toBe("CONC");
  });

  it("⚑ LA GARDE ADMET LES CINQ — y compris celle dont la famille est inconnue", () => {
    // Le faux rouge que cette assertion existe pour empêcher : une garde qui
    // exigerait une famille CONNUE rougirait sur la seule valeur dont il est
    // acté que l'origine ne l'est pas. Elle punirait la valeur pour l'aveu
    // qu'on a exigé d'elle.
    //
    // La règle d'opacité rend cette exigence non seulement injuste mais
    // incohérente : si le segment ne signifie rien, ne pas savoir ce qu'il
    // « voulait dire » n'est pas un manque.
    for (const r of REFS_REELS) {
      expect(typeof r.ref, `${r.ref} rejeté par la garde`).toBe("string");
      expect(r.ref.length, `${r.ref} rejeté par la garde`).toBeGreaterThan(0);
    }
    expect(REFS_REELS).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · CAPACITÉ — le balayage, sur un univers DÉCOUVERT
// ═══════════════════════════════════════════════════════════════════════════

const RACINES = ["src", "prisma", "scripts"] as const;

const fichiersSource = (): string[] => {
  const out: string[] = [];
  const marche = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|\.next/.test(p)) marche(p);
      } else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) out.push(p);
    }
  };
  for (const r of RACINES) marche(r);
  return out;
};

/**
 * LES ANCRES — la surface publique de la couche d'autorité, LUE et non listée.
 *
 * Corollaire de S15 : une liste écrite à la main est plus lisible, elle est
 * d'accord avec son auteur, et c'est exactement le problème. Le jour où
 * l'autorité exporte un nouveau point d'entrée, cette découverte l'intègre
 * sans que personne y pense — une liste, non.
 */
const MODULES_AUTORITE = [
  "src/lib/casefile/publicProjection.ts",
  "src/lib/casefile/canonicalReader.ts",
] as const;

const ancres = (): string[] => {
  const out = new Set<string>();
  for (const f of MODULES_AUTORITE) {
    for (const m of readFileSync(f, "utf8").matchAll(
      /^export\s+(?:async\s+)?(?:const|function|class)\s+([A-Za-z_$][\w$]*)/gm,
    )) {
      out.add(m[1]);
    }
  }
  return [...out];
};

/**
 * L'UNIVERS — qui manipule réellement une référence de dossier.
 *
 * Deux voies, parce qu'une seule laissait un trou mesuré : les consommateurs
 * qui IMPORTENT la couche d'autorité, et ceux qui reçoivent le ref par le bloc
 * canonique sans rien importer d'elle. Le générateur interne est dans le
 * second cas — il n'importe aucune ancre et manipule pourtant le ref à quatre
 * endroits. Un univers découvert par import seul l'aurait manqué, et c'est
 * précisément là que vit la seule dérivation du dépôt.
 */
const univers = (): string[] => {
  const a = ancres();
  return fichiersSource().filter((f) => {
    const s = readFileSync(f, "utf8");
    return a.some((n) => new RegExp(`\\b${n}\\b`).test(s)) || /canonical\??\.ref\b/.test(s);
  });
};

const codeSeul = (contenu: string): Array<[number, string]> =>
  contenu
    .split("\n")
    .map((l, i): [number, string] => [i + 1, l])
    .filter(([, l]) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    });

/** Un porteur de référence de dossier, dans les formes où il circule. */
const PORTEUR = String.raw`(?:readRef\(\)|ref|caseRef|casefileRef|documentRef|dossier\.ref|canonical\??\.ref|case_id|caseId)`;

/**
 * LE MOTIF, EN DEUX VOIES — et la seconde a été trouvée par un mutant, contre
 * la première rédaction de cette garde.
 *
 *   (1) accès direct            ref.split('-')
 *   (2) contournement par cast  (readRef() as string).split('-')
 *
 * La voie (2) manquait. Elle importe précisément dans le monde où RC-7
 * deviendrait un type opaque : le porteur y disparaît derrière la parenthèse
 * du cast, la garde ne voyait plus qu'une parenthèse fermante, et le seul
 * contournement que le compilateur ne peut pas voir était aussi le seul que
 * la garde ne voyait pas. Le filet avait un trou exactement à l'endroit où il
 * devait servir.
 *
 * C'est le mutant qui l'a dit, pas la relecture. Une garde qu'on n'attaque
 * pas est une garde qu'on croit.
 */
const motifDe = (verbes: readonly string[]): RegExp => {
  const v = `(?:${verbes.join("|")})`;
  return new RegExp(
    String.raw`\b${PORTEUR}\s*\.\s*${v}\s*\(` +
      String.raw`|\b${PORTEUR}\s+as\s+\w+\s*\)\s*\.\s*${v}\s*\(`,
  );
};

/**
 * Les opérations qui LISENT le contenu — celles que RC-7 interdit. Elles
 * extraient, comparent ou testent un fragment : toutes prétendent que la
 * valeur a une structure interprétable.
 */
const LECTURES = ["split", "slice", "substring", "substr", "startsWith", "endsWith", "match", "indexOf", "search", "charAt", "includes"] as const;

/**
 * Les transformations qui ne lisent rien — elles réécrivent des caractères
 * sans rien déduire. Interdire les unes n'interdit pas les autres, et les
 * confondre ferait rougir une sanitisation de nom de fichier au titre d'une
 * inférence forensique.
 */
const TRANSFORMS = ["replace", "replaceAll", "normalize", "trim"] as const;

type Fichier = readonly [chemin: string, contenu: string];

/**
 * Le balayage est adressable sur un CORPUS, pas câblé sur le disque.
 *
 * C'est ce qui rend le mutant possible : une garde qui ne saurait lire que
 * l'arbre réel ne pourrait jamais démontrer qu'elle attrape quelque chose —
 * il faudrait introduire la violation dans le dépôt pour le vérifier, ce que
 * personne ne fait, ce qui est exactement pourquoi tant de gardes vertes ne
 * gardent rien.
 */
const balayeCorpus = (corpus: readonly Fichier[], verbes: readonly string[]): string[] => {
  const re = motifDe(verbes);
  const trouve: string[] = [];
  for (const [f, contenu] of corpus) {
    for (const [ln, l] of codeSeul(contenu)) {
      if (re.test(l)) trouve.push(`${f}:${ln} — ${l.trim()}`);
    }
  }
  return trouve;
};

const corpusReel = (): Fichier[] => univers().map((f) => [f, readFileSync(f, "utf8")] as const);

const balaye = (verbes: readonly string[]) => balayeCorpus(corpusReel(), verbes);

describe("S21/b — RC-7 : aucun consommateur ne LIT le contenu d'un ref", () => {
  // ── La garde de la garde, encore ────────────────────────────────────────
  //
  // Un balayage qui ne trouve rien parce qu'il n'a rien regardé rend le même
  // vert qu'un balayage qui ne trouve rien parce qu'il n'y a rien. C'est le
  // faux vert de S10, et il se ferme ici avant la mesure, pas après.
  it("PRÉALABLE — la découverte a effectivement trouvé des ancres et un univers", () => {
    const a = ancres();
    const u = univers();
    expect(a.length, "aucune ancre découverte — la couche d'autorité a bougé").toBeGreaterThan(5);
    expect(a).toContain("loadCanonicalCaseFile");
    expect(u.length, "univers vide — le balayage qui suit ne porterait sur rien").toBeGreaterThan(8);
    // Le générateur interne DOIT y être : c'est le seul fichier du dépôt qui
    // dérive quoi que ce soit d'un identifiant de dossier.
    expect(u).toContain("src/lib/casefile/pdfGenerator.ts");
    // Et les dossiers d'investigateurs NE doivent PAS y être : leur `caseId`
    // est un id de ligne, pas une référence de dossier.
    expect(u.some((f) => f.includes("investigators"))).toBe(false);
  });

  it("⚑ AUCUNE LECTURE de contenu sur un porteur de référence", () => {
    const lectures = balaye(LECTURES);
    expect(
      lectures,
      "RC-7 violée — un consommateur lit le contenu d'une référence de dossier :\n" +
        lectures.map((l) => `      ${l}`).join("\n"),
    ).toEqual([]);
  });

  it("CLIQUET — les transformations sans lecture sont inventoriées, et il y en a UNE", () => {
    // Un cliquet, pas un zéro : une réécriture de caractères ne déduit rien
    // et n'est donc pas interdite par RC-7. Mais elle n'est pas libre pour
    // autant — chaque nouvelle occurrence doit être justifiée ici, et
    // l'écriture de ce test est le lieu où on s'en aperçoit.
    // ── LE CLIQUET S'ANCRE SUR LE SITE, PAS SUR SA LIGNE ────────────────
    //
    // Première écriture : `["src/lib/casefile/pdfGenerator.ts:628"]`. Elle a
    // rougi au lot suivant parce qu'un COMMENTAIRE réécrit plus haut dans le
    // même fichier a décalé la ligne de six — la transformation, elle, n'avait
    // pas bougé d'un caractère.
    //
    // C'est le défaut que j'avais nommé comme contrainte de conception une
    // heure plus tôt, commis dans ma propre garde : UNE GARDE QUI ROUGIT SUR
    // UNE ÉDITION SANS RAPPORT EST UNE GARDE QU'ON DÉSARME. Un numéro de ligne
    // n'identifie pas un site de code, il identifie sa position — et la
    // position bouge pour des raisons qui ne regardent pas la garde.
    //
    // Le cliquet porte donc sur le COUPLE (fichier, expression), qui est stable
    // sous le déplacement et sensible à ce qui compte : si l'expression change,
    // c'est une autre transformation, et elle doit être re-justifiée. La ligne
    // reste dans le message d'échec, où elle sert à trouver le site sans
    // jamais servir à décider.
    const transforms = balaye(TRANSFORMS);
    const site = (t: string) => {
      const [emplacement, expression] = t.split(" — ");
      return `${emplacement.replace(/:\d+$/, "")} :: ${expression}`;
    };
    expect(
      transforms.map(site),
      `inventaire des transformations modifié :\n${transforms.map((t) => `      ${t}`).join("\n")}`,
    ).toEqual([
      'src/lib/casefile/pdfGenerator.ts :: const slug = input.case_meta.case_id.replace(/[^a-zA-Z0-9-]/g, "_");',
    ]);

    // ── LA SEULE, ET CE QU'ELLE EST EXACTEMENT ──────────────────────────
    //
    //   const slug = input.case_meta.case_id.replace(/[^a-zA-Z0-9-]/g, "_")
    //
    // Elle compose la clé d'archive à partir de l'identifiant, en
    // remplaçant les caractères hors alphabet de stockage. Elle ne déduit
    // rien : aucune famille, aucune méthodologie, aucun statut. RC-7 n'est
    // pas en cause.
    //
    // DEUX CHOSES SONT VRAIES EN MÊME TEMPS, et les tenir séparées est le
    // point : cette ligne est conforme à RC-7, et elle est l'un des
    // emplacements que RC-5 doit faire dériver du ref gouverné, puisqu'elle
    // porte aujourd'hui l'espace hérité. Une garde d'opacité n'a pas à
    // trancher une question de cardinalité, et ne le fait pas ici.
    expect(transforms).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · LES MUTANTS — la garde a-t-elle des dents ?
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  Une garde VERTE qui n'a jamais rien attrapé est indiscernable d'une   ██
// ██  garde qui ne peut rien attraper.                                      ██
//
// Le §B est vert. Deux lectures en découlent, opposées : « le dépôt est
// conforme » ou « le balayage ne marche pas ». Rien dans un vert ne les
// sépare — sauf des mutants, qui sont la seule preuve qu'un vert soit une
// mesure et non un silence.
//
// Les corpus ci-dessous sont SYNTHÉTIQUES et ne touchent jamais le disque :
// démontrer qu'une garde attrape une violation ne doit pas exiger d'introduire
// la violation dans le dépôt.

describe("S21/c — MUTANTS : chaque forme interdite est effectivement attrapée", () => {
  const mutant = (ligne: string): Fichier[] => [["MUTANT.ts", `const x = 1;\n${ligne}\n`]];

  it.each([
    ["extraction de segment", "const famille = dossier.ref.split('-')[1];"],
    ["test de préfixe", "if (ref.startsWith('IL-SHILL')) return 'shill';"],
    ["test de suffixe", "const premier = ref.endsWith('-001');"],
    ["fragment par position", "const espace = casefileRef.slice(0, 2);"],
    ["appartenance partielle", "const estShill = ref.includes('SHILL');"],
    ["motif sur la forme", "const m = caseId.match(/^IL-([A-Z]+)-/);"],
    ["recherche de fragment", "if (canonical.ref.indexOf('PND') >= 0) {}"],
    ["contournement par cast", "const f = (readRef() as string).split('-')[1];"],
  ])("MUTANT — %s est attrapé", (_nom, ligne) => {
    expect(balayeCorpus(mutant(ligne), LECTURES)).toHaveLength(1);
  });

  // ── LE MUTANT INVERSE, ET C'EST LE PLUS IMPORTANT ──────────────────────
  //
  // Une garde qui attrape tout est aussi inutile qu'une garde qui n'attrape
  // rien : elle rougit sur du code irréprochable, on la désarme, et il ne
  // reste ni l'un ni l'autre. Ces trois lignes DOIVENT passer.
  it.each([
    ["un id de ligne d'investigateur, tronqué pour un nom de fichier", "const court = row.id.slice(0, 8);"],
    ["une référence de MÉTHODOLOGIE, un autre espace entièrement", "const mid = methodRef.split('/')[0];"],
    ["un mint, qui n'est pas une référence de dossier", "const debut = mint.slice(0, 8);"],
  ])("NON-MUTANT — %s n'est PAS attrapé", (_nom, ligne) => {
    expect(balayeCorpus(mutant(ligne), LECTURES)).toEqual([]);
  });

  it("le commentaire qui CITE une forme interdite n'est pas compté comme un porteur", () => {
    // La faute que ce corpus s'est déjà infligée deux fois : un commentaire
    // qui documente le défaut se fait recenser comme une occurrence du défaut.
    // Une documentation qui CITE ne doit pas se faire passer pour du code qui
    // FAIT.
    const commente: Fichier[] = [["MUTANT.ts", "// const famille = dossier.ref.split('-')[1];\n"]];
    expect(balayeCorpus(commente, LECTURES)).toEqual([]);
  });
});
