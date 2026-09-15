// LE VOCABULAIRE CLOS — ce que le preflight refuse, et pourquoi.
//
// Deux vocabulaires DISTINCTS, qui ne doivent jamais fusionner :
//
//   SECRET_FORMS       des formes PORTEUSES DE CREDENTIALS. Refus immédiat.
//   AMBIGUOUS_FORMS    des formes du VOISINAGE des secrets que le vocabulaire
//                      ne résout pas. Refusées comme INDÉCIDABLES.
//
// ─── L'ASYMÉTRIE, ET ELLE EST LA MÊME QUE CELLE DU GUARD ─────────────────────
//
//   Une forme peut REFUSER. Aucune forme ne peut AUTORISER.
//
// Il n'y a donc pas d'allowlist de secrets, et il ne peut pas y en avoir : on
// ne fait pas passer un fichier en l'inscrivant ici, on le fait passer en
// CESSANT DE L'EXPÉDIER (`.vercelignore`). C'est ce qui empêche ce vocabulaire
// de redevenir un système d'exemptions — il n'a aucune porte de sortie.
//
// AMBIGUOUS_FORMS n'est pas « une heuristique qui devine » : elle ne rend
// jamais de verdict positif. Elle dit « je ne sais pas », et le preflight
// traite « je ne sais pas » comme un refus. C'est le sens exact de la consigne :
// si l'on ne peut pas décider d'une forme, elle est refusée.
//
// ⚠️ Son DOMAINE est borné, et la borne est mesurée. Appliquée à tous les
// fichiers, `/token/` rougirait sur `src/lib/security/tokenBucket.ts` et le
// preflight serait rouge à perpétuité — un contrôle toujours rouge n'est pas un
// contrôle, c'est un interrupteur qu'on finit par couper. Le domaine est donc
// restreint aux porteurs de DONNÉES (config, dumps, scripts shell, sauvegardes,
// fichiers sans extension, dotfiles) — jamais au code source.
// Vérifié en vif par __tests__/preflight/ sur l'ensemble expédié réel.

import { basename, extname } from "node:path";

const seg = (p) => p.split("/");
const base = (p) => basename(p);
const ext = (p) => extname(p).slice(1).toLowerCase();

/** Répertoires dont la SEULE présence suffit : tout ce qu'ils contiennent est
 *  du matériel d'identification. */
const CRED_DIRS = new Set([".aws", ".ssh", ".gnupg", ".docker", ".kube", ".azure"]);

/** Extensions de matériel cryptographique privé. */
const KEY_EXTS = new Set(["pem", "key", "p12", "pfx", "jks", "keystore", "asc", "gpg", "ppk"]);

/**
 * VOCABULAIRE CLOS DES SECRETS.
 * Chaque entrée est explicite, nommée, et porte sa raison. Aucune entrée n'est
 * une devinette : chacune désigne une forme dont la charge est connue.
 */
export const SECRET_FORMS = [
  {
    id: "dotenv",
    why: "fichier d'environnement — porte DATABASE_URL, ADMIN_TOKEN, CRON_SECRET, clés d'API",
    // Couvre la FORME GÉNÉRALE, pas l'instance trouvée : .env, .env.local,
    // .env.production, .env-backup, .env_old, .env.prod.2026.
    test: (p) => /^\.env($|[.\-_])/.test(base(p)),
  },
  {
    id: "envrc",
    why: "direnv — exporte des variables d'environnement à l'entrée du répertoire",
    test: (p) => base(p) === ".envrc",
  },
  {
    id: "private-key-material",
    why: "matériel cryptographique privé",
    test: (p) => KEY_EXTS.has(ext(p)),
  },
  {
    id: "ssh-private-key",
    why: "clé SSH privée",
    test: (p) => /^id_(rsa|dsa|ecdsa|ed25519)$/.test(base(p)),
  },
  {
    id: "registry-or-host-cred",
    why: "identifiants de registre ou d'hôte",
    test: (p) => [".npmrc", ".netrc", "_netrc", ".pgpass", ".my.cnf", ".htpasswd"].includes(base(p)),
  },
  {
    id: "cred-directory",
    why: "répertoire d'identifiants d'un fournisseur",
    test: (p) => seg(p).some((s) => CRED_DIRS.has(s)),
  },
  {
    id: "cloud-service-account",
    why: "compte de service ou jeton d'outil en ligne de commande",
    test: (p) =>
      ["credentials", "service-account.json", "serviceaccount.json", "gcloud-key.json", "auth.json", ".boto"]
        .includes(base(p)),
  },
  {
    id: "shell-history",
    why: "historique de shell — contient les secrets collés en ligne de commande",
    test: (p) => [".bash_history", ".zsh_history", ".psql_history", ".node_repl_history"].includes(base(p)),
  },
];

/** Le DOMAINE d'AMBIGUOUS_FORMS : porteurs de données, jamais du code source. */
const DATA_EXTS = new Set([
  "json", "yaml", "yml", "ini", "conf", "cfg", "toml", "txt", "properties", "csv", "tsv",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  "bak", "backup", "old", "orig", "save", "tmp", "dump", "sql", "log",
]);

function dansLeDomaineAmbigu(p) {
  const b = base(p);
  if (b.startsWith(".")) return true; // dotfile
  const e = ext(p);
  if (e === "") return true; // sans extension
  return DATA_EXTS.has(e);
}

/**
 * VOCABULAIRE CLOS DES FORMES INDÉCIDABLES.
 * Ne rend JAMAIS un verdict positif. Rougir ici veut dire « le vocabulaire ne
 * sait pas trancher », et le preflight refuse par défaut.
 */
export const AMBIGUOUS_FORMS = [
  {
    id: "secret-adjacent-name",
    why: "le nom annonce une charge sensible, et le vocabulaire ne sait pas trancher",
    // ⚠️ `token` NU EST INTERDIT ICI, et la raison est mesurée, pas théorique.
    // Dans CE dépôt, « token » est un nom métier de premier plan — un jeton
    // crypto. Le vocabulaire a d'abord rougi sur
    // `tests/lib/mm/fixtures/{asymmetric-price,concentrated}-token.json`, deux
    // fixtures parfaitement légitimes. Un contrôle qui rougit sur le métier est
    // un contrôle qu'on désarme. `token` n'est donc retenu QUE collé à un mot
    // d'authentification, ce qui garde le signal (`auth-token.json`) sans la
    // collision (`concentrated-token.json`).
    test: (p) =>
      dansLeDomaineAmbigu(p) &&
      /(secret|credential|passwd|password|(auth|access|refresh|bearer|api|session)[._-]?tokens?|apikey|api[._-]key|private[._-]?key|privkey)/i.test(
        base(p),
      ),
  },
];

export const VERDICT = { CLEAR: "CLEAR", SECRET: "SECRET", UNDECIDABLE: "UNDECIDABLE" };

/**
 * Classe UN chemin. Total : rend toujours un verdict, jamais `undefined`.
 * L'ordre compte — une forme connue prime sur l'indécidable, pour que le
 * journal nomme la VRAIE raison et pas « je ne sais pas ».
 */
export function classify(path) {
  for (const f of SECRET_FORMS) {
    if (f.test(path)) return { verdict: VERDICT.SECRET, formId: f.id, why: f.why };
  }
  for (const f of AMBIGUOUS_FORMS) {
    if (f.test(path)) return { verdict: VERDICT.UNDECIDABLE, formId: f.id, why: f.why };
  }
  return { verdict: VERDICT.CLEAR, formId: null, why: null };
}

/** Le gate : rend la liste des refus sur un manifeste entier. */
export function screenManifest(manifest) {
  const refus = [];
  for (const { path } of manifest) {
    const c = classify(path);
    if (c.verdict !== VERDICT.CLEAR) refus.push({ path, ...c });
  }
  return refus;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATED — et non « ignoré », « toléré », ou « exempté »
// ═══════════════════════════════════════════════════════════════════════════
//
// Le prédicat du §3 est une ÉGALITÉ :
//
//     manifeste d'upload − GENERATED_ALLOWED  ==  HEAD filtré
//     ET aucun fichier de HEAD attendu après filtre n'est absent
//
// GENERATED_ALLOWED est la SEULE soupape, et elle est construite pour ne pas
// pouvoir s'élargir en silence. Cinq contraintes, toutes vérifiées par
// __tests__/preflight/ :
//
//   1. CHEMINS EXACTS. Égalité de chaîne. Aucun joker, aucun préfixe, aucune
//      ancre — la même règle que les chemins d'une lease du guard. Un
//      `packages/*/dist/` est impossible à écrire ici.
//   2. NOMINATIVE ET MOTIVÉE. Quatre champs obligatoires, dont `generator`
//      (QUI le produit) et `provedBy` (COMMENT on sait que le build distant en
//      a besoin). Un champ vide est rouge.
//   3. CARDINALITÉ ÉPINGLÉE DANS LE TEST. Le test énumère l'ensemble ATTENDU et
//      son cardinal. Ajouter un membre sans toucher au test est rouge : il faut
//      DEUX modifications explicites, dans deux fichiers, pour élargir.
//   4. AUCUN SECRET, AUCUNE CONFIG, AUCUNE SOURCE MÉTIER. Un membre qui tombe
//      sous SECRET_FORMS ou AMBIGUOUS_FORMS, ou qui vit sous `src/`, est rouge.
//   5. EXCLURE D'ABORD. Un candidat n'entre ici que si l'on DÉMONTRE que le
//      build distant en a besoin. Dans le doute : `.vercelignore`, pas ici.
//
// ─── CE QUI A ÉTÉ EXCLU PLUTÔT QU'AUTORISÉ (2026-09-15) ──────────────────────
// Les 24 fichiers mesurés hors commit sur le déploiement servi ont tous été
// traités par exclusion. Aucun n'est entré ici :
//   .env, .claude/*, .wrangler/state/*   → secrets et état local de poste
//   packages/widget/dist/* (8)           → aucune référence dans src/, next.config.ts,
//                                          package.json, pnpm-workspace.yaml
//   public/tiger/{green,orange,red}.mp4  → aucune référence dans tout le dépôt (30 Mo)
//   AGENTS.md, AUDIT_CLOSURE_*.md,
//   check_demo_restore.sh                → documents
//   next-env.d.ts                        → RÉÉCRIT par `next build`, jamais lu en entrée
//   tsconfig.tsbuildinfo                 → cache incrémental de tsc (754 Ko), inutile
//                                          à un build distant qui part d'un cache vide
//
// `public/tiger/analyst.png` n'est NI exclu NI autorisé, et c'est délibéré :
// il est RÉFÉRENCÉ par src/components/TigerRevealCard.tsx:109 et n'existe dans
// AUCUN commit. L'autoriser ferait passer pour un artefact de build un contenu
// dont la production dépend ; l'exclure casserait l'image en silence. Le
// preflight reste donc ROUGE dessus — c'est le constat, pas un défaut du
// contrôle. Résolution dans docs/prep/.

/** L'état. Chemins EXACTS. Vide serait la valeur la plus stricte. */
export const GENERATED_ALLOWED = [
  {
    path: "public/.well-known/source-set.json",
    classification: "GENERATED",
    generator: "scripts/preflight-deploy.mjs --emit-marker",
    why: "marqueur d'identité du source-set : il EST la sortie du preflight, et il doit être dans l'ensemble expédié pour être servi.",
    provedBy: "produit par le preflight lui-même, juste avant l'upload ; exclu de sa propre racine (voir merkleRoot).",
    addedAt: "2026-09-15",
  },
];

export const GENERATED_PATHS = new Set(GENERATED_ALLOWED.map((g) => g.path));
