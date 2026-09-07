// ─── BUILD 8 — MUTATION CHECK ──────────────────────────────────────────────
//
//   node scripts/kol-memory/mutation-check.mjs
//
// Un test vert ne prouve rien tant qu'on n'a pas montré qu'il PEUT rougir.
// Ce script réintroduit chaque défaut corrigé, un par un, dans une COPIE du
// source, relance la suite, et exige le rouge. Correspondance 1:1 : un
// invariant, un mutant, un tueur.
//
// Aucune écriture hors de /tmp : les sources du repo sont restaurées à
// l'identique (sha256 vérifié) même en cas d'échec.

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = "src/lib/kol-memory";
const TESTS = "__tests__/kol-memory";

const ENV = {
  ...process.env,
  DATABASE_URL: "postgresql://ci:ci@db.invalid:5432/none?sslmode=disable",
  ADMIN_TOKEN: "ci-not-a-secret",
  VAULT_AUDIT_SALT: "ci-not-a-secret",
  ADMIN_BASIC_USER: "ci",
  ADMIN_BASIC_PASS: "ci-not-a-secret",
};

/**
 * Chaque mutant nomme l'invariant qu'il attaque, le défaut historique qu'il
 * réintroduit, et la substitution exacte qui le réintroduit.
 */
const MUTANTS = [
  {
    id: "INV-1",
    invariant: "AttributionUpgradeError — l'attribution ne remonte jamais l'échelle",
    defaut: "resolveWalletToKol rendait `exact` pour toute ligne existante",
    file: `${SRC}/attribution.ts`,
    from: "  if (CONFIDENCE_RANK[derived] > CONFIDENCE_RANK[ceiling]) {",
    to: "  if (false) {",
  },
  {
    id: "INV-2",
    invariant: "`exact` exige confirmed ET verified_onchain",
    defaut: "confirmer une source suffisait à atteindre le rang maximal",
    file: `${SRC}/attribution.ts`,
    from: '  if (status === "confirmed" && claim === CLAIM_VERIFIED_ONCHAIN) return "exact";',
    to: '  if (status === "confirmed") return "exact";',
  },
  {
    id: "INV-3",
    invariant: "une source inconnue tombe en `inferred`, jamais en `manual`",
    defaut: "mapDbSource posait `manual` par défaut",
    file: `${SRC}/attribution.ts`,
    from: "  if (claim === CLAIM_SOURCE_ATTRIBUTED || claim === CLAIM_ANALYTICAL_ESTIMATE) return \"inferred\";\n  return \"inferred\";",
    to: '  return "manual";',
  },
  {
    id: "INV-4",
    invariant: "fail-closed — une colonne non sélectionnée ne publie rien",
    defaut: "/api/kol/[handle] servait ses wallets sans aucun filtre",
    file: `${SRC}/walletPublication.ts`,
    from: "  if (row.isPubliclyUsable !== true) return false;",
    to: "  if (row.isPubliclyUsable === false) return false;",
  },
  {
    id: "INV-5",
    invariant: "une ligne sans nature sort en UNCLASSIFIED, elle n'hérite d'aucun défaut",
    defaut: "un défaut implicite — le mécanisme même des sept sites de mélange",
    file: `${SRC}/walletPublication.ts`,
    from: "  return isNatureValue(row.rowNature) ? row.rowNature : UNCLASSIFIED;",
    to: '  return isNatureValue(row.rowNature) ? row.rowNature : "PRIMARY_OBSERVATION";',
  },
  {
    id: "INV-6",
    invariant: "la clé de route synthétique n'est JAMAIS acceptée comme mint",
    defaut: "deux BOTIFY servaient le même écran ; le 43 n'existe dans aucune ligne",
    file: `${SRC}/tokenIdentity.ts`,
    from: "  if (isSyntheticRouteKey(value)) {\n    throw new SyntheticKeyAsMintError(where);\n  }",
    to: "  if (false) {\n    throw new SyntheticKeyAsMintError(where);\n  }",
  },
  {
    id: "INV-7",
    invariant: "handle → mint rend l'identité canonique, jamais la clé synthétique",
    defaut: "handleToMint.ts pointait les pages KOL vers le 43 caractères",
    file: `${SRC}/tokenIdentity.ts`,
    from: '  if (BOTIFY_KOLS.has(handle)) return BOTIFY_MINT as TokenMint;',
    to: '  if (BOTIFY_KOLS.has(handle)) return BOTIFY_SYNTHETIC_ROUTE_KEY as unknown as TokenMint;',
  },
  {
    id: "INV-8",
    invariant: "un montant valorisé par un prix tiers est INFERENCE, pas THIRD_PARTY_DATA",
    defaut: "M4 — étiqueter du nom d'un fournisseur un chiffre qu'il n'a jamais publié",
    file: `${SRC}/proceedsNature.ts`,
    from: '        nature: "INFERENCE",\n        basis: {\n          formula: "amountUsd = quantité constatée on-chain × clôture quotidienne Binance",',
    to: '        nature: "THIRD_PARTY_DATA",\n        basis: {\n          formula: "amountUsd = quantité constatée on-chain × clôture quotidienne Binance",',
  },
  {
    id: "INV-9",
    invariant: "un prix remplacé par une constante est une ESTIMATE",
    defaut: "188 lignes valorisées à une constante, additionnées comme des prix observés",
    file: `${SRC}/proceedsNature.ts`,
    from: "    case PRICING_SOURCES.YEARLY_FALLBACK:\n      return {\n        nature: \"ESTIMATE\",",
    to: "    case PRICING_SOURCES.YEARLY_FALLBACK:\n      return {\n        nature: \"INFERENCE\",",
  },
  {
    id: "INV-10",
    invariant: "une pricingSource inconnue n'obtient PAS de nature par défaut",
    defaut: "le défaut implicite — mécanisme des sept sites de mélange",
    file: `${SRC}/proceedsNature.ts`,
    from:
      "    default:\n      return UNCLASSIFIED_RESULT(\n        src.length > 0",
    to:
      "    default:\n      return { nature: \"THIRD_PARTY_DATA\", basis: null, why: \"défaut implicite\" };\n      // eslint-disable-next-line no-unreachable\n      return UNCLASSIFIED_RESULT(\n        src.length > 0",
  },
  {
    id: "INV-11",
    invariant: "la provenance du chiffre n'est déclarée que si la source a été LUE",
    defaut: "canonical.ts posait proceedsSource: 'KolProceedsEvent' en littéral",
    file: `${SRC}/proceedsProvenance.ts`,
    from: '    source: verifie ? "KolProceedsEvent" : null,',
    to: '    source: "KolProceedsEvent",',
  },
  {
    id: "INV-12",
    invariant: "une source non consultée rend NOT_VERIFIED, jamais un succès",
    defaut: "confondre « pas vérifié » et « pas de chiffre » affirme une absence non constatée",
    file: `${SRC}/proceedsProvenance.ts`,
    from: '  if (input.sourceUsd === undefined || source === null) return "NOT_VERIFIED";',
    to: '  if (input.sourceUsd === undefined || source === null) return "NO_FIGURE";',
  },
];

function sha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function suiteIsGreen() {
  try {
    execSync(`npx vitest run ${TESTS}`, { env: ENV, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const touched = [...new Set(MUTANTS.map((m) => m.file))];
const backups = new Map();
const shaBefore = new Map();
for (const f of touched) {
  const b = join(tmpdir(), `b8-mutation-${Date.now()}-${f.replace(/\W/g, "_")}`);
  copyFileSync(f, b);
  backups.set(f, b);
  shaBefore.set(f, sha(f));
}

function restore() {
  for (const [f, b] of backups) copyFileSync(b, f);
}

let failures = 0;
try {
  console.log("# BUILD 8 — mutation check\n");

  if (!suiteIsGreen()) {
    console.error("❌ La suite est ROUGE avant toute mutation. Rien à prouver.");
    process.exit(1);
  }
  console.log("✅ baseline verte\n");

  for (const m of MUTANTS) {
    const original = readFileSync(m.file, "utf8");
    if (!original.includes(m.from)) {
      console.error(`❌ ${m.id} — motif introuvable dans ${m.file}. Mutant périmé.`);
      failures++;
      continue;
    }
    writeFileSync(m.file, original.replace(m.from, m.to));
    const green = suiteIsGreen();
    writeFileSync(m.file, original);

    if (green) {
      console.error(`❌ ${m.id} — MUTANT SURVIVANT : ${m.invariant}`);
      console.error(`   défaut réintroduit sans qu'aucun test ne rougisse : ${m.defaut}`);
      failures++;
    } else {
      console.log(`✅ ${m.id}  · ${m.invariant}`);
      console.log(`         → rouge quand on réintroduit : ${m.defaut}`);
    }
  }
} finally {
  restore();
  for (const [f, before] of shaBefore) {
    if (sha(f) !== before) {
      console.error(`❌ RESTAURATION INCOMPLÈTE de ${f} — vérifier avant de committer.`);
      failures++;
    }
  }
  for (const b of backups.values()) {
    try {
      unlinkSync(b);
    } catch {
      /* le fichier temporaire a déjà disparu — sans conséquence */
    }
  }
}

console.log(
  failures === 0
    ? `\n✅ ${MUTANTS.length}/${MUTANTS.length} mutants tués. Sources restaurées à l'identique.`
    : `\n❌ ${failures} échec(s).`,
);
process.exit(failures === 0 ? 0 : 1);
