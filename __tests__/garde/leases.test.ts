/**
 * __tests__/garde/leases.test.ts
 *
 * LE CRITÈRE DU MÉCANISME DE LEASES.
 *
 *   Static exemptions converge to zero. Legitimate openings become explicit,
 *   bounded, versioned leases.
 *
 *   Branch naming may select a workflow; it must never itself grant authority.
 *
 * Ces témoins ne décrivent pas le mécanisme : ils l'EXÉCUTENT. Chaque cas monte
 * un dépôt git jetable, y pose le guard réel, et le fait juger DEPUIS `main` —
 * exactement comme le fait la CI. Aucune PR, aucune branche réelle, aucune
 * violation écrite dans le dépôt.
 *
 * ─── POURQUOI L'HORLOGE EST UN PARAMÈTRE, ET NON UNE IMPURETÉ À ABSTRAIRE ────
 *
 *   When the governed property is elapsed exposure time, wall-clock time is
 *   authority-relevant input, not nondeterminism to be abstracted away.
 *
 * La propriété gouvernée est une DURÉE RÉELLE D'EXPOSITION. Un SHA ne mesure pas
 * une heure ; deux commits peuvent prendre trois minutes ou trois jours. Le temps
 * entre donc dans le verdict — et il est INJECTÉ ici pour que les trois points
 * d'expiration soient déterministes.
 *
 * ⚠️ La chronologie du dépôt jetable est posée AVANT l'instant injecté. Ce n'est
 * pas un détail de confort : `maintenant` vaut `max(horloge, date du commit de
 * base)`, et au premier essai réel le PLANCHER a écrasé l'horloge injectée. Un
 * témoin dont la chronologie est incohérente ne mesure pas ce qu'il croit.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const GUARD = join(process.cwd(), "scripts/guard-offline.sh");
const DATE_DEPOT = "2026-09-12T13:50:00Z";
const OUVERT = "2026-09-12T14:00:00Z";
const EXPIRE = "2026-09-12T14:45:00Z";

const ROUTE = "src/app/api/v1/kol/[handle]/route.ts";
const AUTRE = "src/app/api/v1/kol/[handle]/autre.ts";
const LIBRE = "src/lib/libre.ts";

const git = (d: string, args: string[]) =>
  execFileSync("git", args, {
    cwd: d,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: DATE_DEPOT, GIT_COMMITTER_DATE: DATE_DEPOT },
  });

function ecrire(d: string, rel: string, contenu: string) {
  mkdirSync(dirname(join(d, rel)), { recursive: true });
  writeFileSync(join(d, rel), contenu);
}

/** Un dépôt jetable : le guard RÉEL sur `main`, et l'état de lease demandé. */
function depot(leases: (base: string) => string[]): string {
  const d = mkdtempSync(join(tmpdir(), "lease-"));
  git(d, ["init", "-q", "-b", "main"]);
  git(d, ["config", "user.email", "t@t.t"]);
  git(d, ["config", "user.name", "T"]);
  ecrire(d, "scripts/guard-offline.sh", readFileSync(GUARD, "utf8"));
  for (const f of [ROUTE, AUTRE, LIBRE]) ecrire(d, f, "v1\n");
  git(d, ["add", "-A"]);
  git(d, ["commit", "-q", "-m", "base"]);
  const base = git(d, ["rev-parse", "HEAD"]).trim();

  const lignes = leases(base);
  const src = readFileSync(join(d, "scripts/guard-offline.sh"), "utf8");
  const corps = lignes.map((l) => `    "${l}"`).join("\n");
  ecrire(
    d,
    "scripts/guard-offline.sh",
    src.replace("LEASES=(\n)", `LEASES=(\n${corps}${corps ? "\n" : ""})`),
  );
  git(d, ["add", "-A"]);
  // `--allow-empty` : l'état VIDE ne change pas le fichier, et c'est un cas de
  // test à part entière — le refuser ici rendrait le témoin 3 inatteignable.
  git(d, ["commit", "-q", "--allow-empty", "-m", "etat de lease"]);
  return d;
}

let dernierJournal = "";

/** Le JOURNAL du guard de `main` — deux refus peuvent avoir le même code. */
function journal(d: string, branche: string, fichiers: string[], now: string): string {
  juge(d, branche, fichiers, now);
  return dernierJournal;
}

/** Le verdict rendu par le guard de `main` — jamais celui de la branche. */
function juge(d: string, branche: string, fichiers: string[], now: string): number {
  git(d, ["checkout", "-q", "main"]);
  const existe = git(d, ["branch", "--list", branche, "--format=%(refname:short)"]).trim();
  if (existe) git(d, ["branch", "-qD", branche]);
  git(d, ["checkout", "-q", "-b", branche]);
  for (const f of fichiers) appendFileSync(join(d, f), "// x\n");
  git(d, ["add", "-A"]);
  git(d, ["commit", "-q", "-m", "pr"]);
  const juge = join(d, ".guard-de-main.sh");
  writeFileSync(juge, git(d, ["show", "main:scripts/guard-offline.sh"]));
  try {
    dernierJournal = execFileSync("bash", [juge], {
      cwd: d, encoding: "utf8", env: { ...process.env, GUARD_NOW_UTC: now },
    });
    return 0;
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    dernierJournal = String(err.stdout ?? "") + String(err.stderr ?? "");
    return err.status ?? 1;
  }
}

const leaseW9 = (base: string) =>
  [`W9|frontiere de publication|${ROUTE}|${base}|feat/cc-offline-99-chantier|${OUVERT}|${EXPIRE}|OPEN`];

describe("lease · les sept témoins", () => {
  let d: string;
  beforeAll(() => { d = depot(leaseW9); });
  afterAll(() => rmSync(d, { recursive: true, force: true }));

  it("1 — lease valide : le chemin EXACT est autorisé", () => {
    expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:30:00Z")).toBe(0);
  });

  it("2 — la MÊME lease, expirée : refusée", () => {
    expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:46:00Z")).toBe(1);
  });

  it("4 — un nom de branche anciennement exempté, SANS lease : refusé", () => {
    // C'est toute la doctrine : le nom ne confère plus rien.
    expect(juge(d, "feat/cc-offline-99-fix-handle-leak", [ROUTE], "2026-09-12T14:30:00Z")).toBe(1);
  });

  it("5 — lease pour le fichier A, la PR modifie B : refusée", () => {
    expect(juge(d, "feat/cc-offline-99-chantier", [AUTRE], "2026-09-12T14:30:00Z")).toBe(1);
  });

  it("le SUJET compte — la même lease ne couvre pas une autre branche", () => {
    expect(juge(d, "feat/cc-offline-98-autre", [ROUTE], "2026-09-12T14:30:00Z")).toBe(1);
  });

  it("un chemin LIBRE reste libre — la lease ne gouverne que le gel", () => {
    expect(juge(d, "feat/cc-offline-99-quelconque", [LIBRE], "2026-09-12T14:30:00Z")).toBe(0);
  });
});

describe("lease · l'état vide est la lecture la PLUS STRICTE", () => {
  it("3 — aucune lease : aucun chemin gelé ne passe", () => {
    const d = depot(() => []);
    try {
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:30:00Z")).toBe(1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it("7 — lease CLOSED : l'ancienne branche est refusée, horloge pourtant valide", () => {
    const d = depot((base) => [
      `W9|frontiere|${ROUTE}|${base}|feat/cc-offline-99-chantier|${OUVERT}|${EXPIRE}|CLOSED`,
    ]);
    try {
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:30:00Z")).toBe(1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("lease · les trois points d'expiration", () => {
  let d: string;
  beforeAll(() => { d = depot(leaseW9); });
  afterAll(() => rmSync(d, { recursive: true, force: true }));

  // `now >= expiresAt` → ROUGE. L'instant d'expiration appartient au refus.
  const points: ReadonlyArray<readonly [string, string, number]> = [
    ["T-1s", "2026-09-12T14:44:59Z", 0],
    ["T   ", "2026-09-12T14:45:00Z", 1],
    ["T+1s", "2026-09-12T14:45:01Z", 1],
  ];
  for (const [nom, now, attendu] of points) {
    it(`${nom} · ${now} → ${attendu === 0 ? "autorisé" : "refusé"}`, () => {
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], now)).toBe(attendu);
    });
  }
});

describe("lease · le théorème — resserrer n'exige aucune autorité", () => {
  /**
   * L'autorité n'est requise que pour ÉLARGIR. Une fermeture ne l'interroge
   * jamais : sans cette propriété, une lease expirée bloquerait sa propre
   * fermeture, et l'expiration fabriquerait exactement la fenêtre
   * qu'on-ne-peut-pas-refermer qu'elle existe pour interdire.
   */
  it("une lease expirée depuis des MOIS ne bloque pas la fermeture", () => {
    const d = depot(leaseW9);
    try {
      git(d, ["checkout", "-q", "-b", "hotfix/guard-fermeture"]);
      const src = readFileSync(join(d, "scripts/guard-offline.sh"), "utf8");
      ecrire(d, "scripts/guard-offline.sh", src.replace(/LEASES=\(\n(?:.*\n)*?\)/, "LEASES=(\n)"));
      git(d, ["add", "-A"]);
      git(d, ["commit", "-q", "-m", "referme"]);
      const j = join(d, ".guard-de-main.sh");
      writeFileSync(j, git(d, ["show", "main:scripts/guard-offline.sh"]));
      for (const now of ["2026-09-12T14:30:00Z", "2027-01-01T00:00:00Z"]) {
        expect(() =>
          execFileSync("bash", [j], { cwd: d, stdio: "pipe", env: { ...process.env, GUARD_NOW_UTC: now } }),
        ).not.toThrow();
      }
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("lease · NON-VACUITÉ — une lease illisible crie, elle ne s'ignore pas", () => {
  /**
   * Sans cette borne, un état que l'analyseur ne comprend plus rendrait
   * « 0 lease extraite = rien à autoriser » — vert par vacuité. C'est la panne
   * exacte que ce mécanisme existe pour interdire, et elle a mordu quatre fois
   * ailleurs dans ce dépôt.
   *
   * Le témoin porte sur une branche qui ne touche QU'UN CHEMIN LIBRE : la
   * validation doit tourner inconditionnellement, pas seulement quand un chemin
   * gelé est en jeu.
   */
  const malformes: ReadonlyArray<readonly [string, (b: string) => string]> = [
    ["champs manquants", () => "W9|deux|champs"],
    ["openedAt non ISO-8601 UTC", (b) => `W9|p|${ROUTE}|${b}|s|pas-une-date|${EXPIRE}|OPEN`],
    ["durée > 45 minutes", (b) => `W9|p|${ROUTE}|${b}|s|2026-09-12T14:00:00Z|2026-09-12T15:00:00Z|OPEN`],
    ["joker dans un chemin", (b) => `W9|p|src/*|${b}|s|${OUVERT}|${EXPIRE}|OPEN`],
    ["état inconnu", (b) => `W9|p|${ROUTE}|${b}|s|${OUVERT}|${EXPIRE}|PEUT-ÊTRE`],
  ];
  for (const [nom, fab] of malformes) {
    it(`${nom} → ROUGE, même sur un chemin libre`, () => {
      const d = depot((b) => [fab(b)]);
      try {
        expect(juge(d, "feat/cc-offline-99-quelconque", [LIBRE], "2026-09-12T14:30:00Z")).toBe(1);
      } finally { rmSync(d, { recursive: true, force: true }); }
    });
  }
});

describe("lease · un bloc PRÉSENT mais expiré n'est pas un bloc ABSENT", () => {
  /**
   *   lease EXPIRÉE → n'autorise plus rien, MÊME SI SON BLOC EST ENCORE DANS
   *                   L'ARBRE.
   *
   * Les deux refusent, donc le code de sortie NE SUFFIT PAS à les distinguer.
   * Ce témoin lit le JOURNAL, parce qu'on ne répare pas les deux de la même
   * façon : l'une est une autorisation périmée, à réconcilier ; l'autre est une
   * autorisation qui n'a jamais existé.
   */
  it("expirée : refusée, et le journal NOMME l'expiration", () => {
    const d = depot(leaseW9);
    try {
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:46:00Z")).toBe(1);
      const j = journal(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:46:00Z");
      expect(j).toContain("EXPIRÉE");
      expect(j).toContain(EXPIRE);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it("absente : refusée, et le journal ne parle PAS d'expiration", () => {
    const d = depot(() => []);
    try {
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:30:00Z")).toBe(1);
      expect(journal(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:30:00Z")).not.toContain("EXPIRÉE");
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it("le bloc expiré est TOUJOURS dans l'arbre — c'est bien lui qu'on refuse", () => {
    const d = depot(leaseW9);
    try {
      // Sans cette assertion, « refusée » serait indiscernable de « disparue ».
      expect(git(d, ["show", "main:scripts/guard-offline.sh"])).toContain("W9|");
      expect(juge(d, "feat/cc-offline-99-chantier", [ROUTE], "2026-09-12T14:46:00Z")).toBe(1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("lease · aucune prolongation implicite", () => {
  it("deux enregistrements sous le MÊME windowId : refusés", () => {
    // Renouveler, c'est une NOUVELLE lease. Réécrire une expiration active sous
    // la même identité serait une prolongation silencieuse.
    const d = depot((base) => [
      `W9|p|${ROUTE}|${base}|feat/cc-offline-99-chantier|${OUVERT}|${EXPIRE}|CLOSED`,
      `W9|p|${ROUTE}|${base}|feat/cc-offline-99-chantier|${OUVERT}|2026-09-12T14:44:00Z|OPEN`,
    ]);
    try {
      expect(juge(d, "feat/cc-offline-99-quelconque", [LIBRE], "2026-09-12T14:30:00Z")).toBe(1);
      expect(journal(d, "feat/cc-offline-99-quelconque", [LIBRE], "2026-09-12T14:30:00Z"))
        .toContain("en double");
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("lease · l'inventaire des exemptions statiques, déclaré", () => {
  /**
   * ⚠️ On n'annonce pas « 25 supprimées ». On déclare ce qui RESTE, et pourquoi.
   * Mélanger le delta d'un chantier et l'état global est l'erreur qu'on vient de
   * découvrir ailleurs ; elle ne se refait pas dans l'annonce du correctif.
   */
  const src = readFileSync(GUARD, "utf8");

  it("STATIC PROJECT EXEMPTIONS = 1 — et c'est OFFLINE_EXEMPT_PATTERNS", () => {
    const conditionnelles = src.match(/if \[\[ "\$BRANCH" =~ \^(?:feat\/cc-offline|hotfix\/)[^]]*\]\]; then\n\s*EXEMPT_/g) ?? [];
    expect(conditionnelles).toHaveLength(0);
    expect(src).not.toContain("EXEMPT_SETUP_PATTERNS");
    expect(src).toContain("OFFLINE_EXEMPT_PATTERNS");
  });

  it("la seule restante est JUSTIFIÉE mais NON BORNÉE — 2 chemins, aucune condition", () => {
    const bloc = src.slice(src.indexOf("OFFLINE_EXEMPT_PATTERNS=("));
    const chemins = bloc.slice(0, bloc.indexOf(")")).match(/"[^"]+"/g) ?? [];
    expect(chemins).toHaveLength(2);
  });

  it("la borne de 45 minutes vit DANS le mécanisme, pas dans une consigne", () => {
    expect(src).toContain("LEASE_DUREE_MAX_S=2700");
  });
});
