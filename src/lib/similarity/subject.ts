// --- BUILD 7 / S3-G1 — L'IDENTITÉ DU SUJET, ET SON REFUS ------------------
//
// PUR. Aucune base, aucun réseau, aucun Helius. Une table de faits résolus en
// lecture seule le 2026-09-05, et une garde qui lève.
//
// ██ LE DANGER, MESURÉ ██
//
// BOTIFY porte DEUX chaînes qui se ressemblent à une lettre près :
//
//   BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb   44 car.  ← le mint réel
//   BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb    43 car.  ← une clé de route
//
// LES DEUX SE DÉCODENT EN EXACTEMENT 32 OCTETS en base58. Aucune vérification
// de FORME ne peut donc les distinguer : la clé synthétique est structurellement
// un pubkey Ed25519 valide. Seule une AUTORITÉ peut trancher, et c'est pourquoi
// cette table existe plutôt qu'un validateur.
//
// ─── CE QUI TRANCHE, ET CE QUI NE TRANCHE PAS ────────────────────────────
//
// TRANCHE — le mint « avec i » est le seul porté par les tables de preuve :
//   · CA_MAP (src/lib/kol/proceeds.ts) : BOTIFY, BOTIFY-MAIN, SERIAL-12RUGS ;
//   · capture DexScreener (v3/__fixtures__/dexscreener.mint.BOTIFY.json) :
//     baseToken.address de la paire Raydium réelle BourCfkdGsr55XAVzDeU6tci7twRTiCGRvCLioENnBBX ;
//   · corpus doctrinal du Resolver v3 : `export const LIVE` — « contrats réels » ;
//   · trace OSINT réelle (scripts/osint/out-botify-david-trace.json) :
//     154 signatures inspectées, txHash opposables ;
//   · ep-square-band, lecture seule 2026-09-05 : ShillEvent 5 lignes,
//     KolTokenLink 5 lignes — TOUTES sur « avec i ».
//
// NE TRANCHE PAS — le commentaire de src/lib/casefile/presets.ts qui dit de la
// clé de route « the route key is the canonical one ». C'est vrai DANS SON
// PÉRIMÈTRE (le routage casefile) et faux comme affirmation d'identité
// on-chain. Lu hors contexte, il envoie droit sur la clé synthétique — c'est
// exactement le piège que ce module ferme.
//
// ██ LA MESURE QUI CLÔT LE DÉBAT ██ Sur ep-square-band, le 2026-09-05, la clé
// « sans i » compte 0 ligne dans ExitEvent, 0 dans ShillEvent, 0 dans
// KolTokenLink. Elle n'est l'identité de rien : c'est une clé de LOOKUP.

/** Ce qu'une chaîne non canonique EST réellement. Jamais « une faute de frappe ». */
export type NonCanonicalKeyKind = "CASEFILE_ROUTE_KEY" | "DEMO_PRESET_KEY";

export interface NonCanonicalKey {
  key: string;
  kind: NonCanonicalKeyKind;
  /** Ce que la clé sert à retrouver, et où. */
  usedBy: readonly string[];
  /** Pourquoi elle n'est pas une identité on-chain. */
  why: string;
}

/**
 * ██ LES CLÉS QUI NE SONT PAS DES MINTS. ██
 *
 * Corriger l'une d'elles « vers » le mint canonique casserait soit la jointure
 * casefile, soit des snapshots d'anti-régression : elles sont LÉGITIMES à leur
 * place. Ce qui est interdit, c'est de les faire entrer ici comme identité.
 */
export const NON_CANONICAL_KEYS: readonly NonCanonicalKey[] = [
  {
    key: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    kind: "CASEFILE_ROUTE_KEY",
    usedBy: [
      "src/lib/demo/presets.ts › SOL_PRESETS.red.addr",
      "src/app/api/casefile/public/route.ts › MINT_TO_PRESET",
      "src/app/api/casefile/pdf/route.ts › MINT_TO_PRESET",
      "src/lib/casefile/presets.ts › MINT_TO_CASEFILE_PRESET",
      "src/data/cases/botify.json › case_meta.mint",
      "exports/BOTIFY_EVIDENCE_TABLE.json › evidenceUrl",
    ],
    why:
      "0 ligne dans ExitEvent, ShillEvent et KolTokenLink (ep-square-band, lecture " +
      "seule 2026-09-05). L'export de preuves qui la porte a wallets, amountUsd et " +
      "txHashes VIDES : c'est une table de démonstration, pas une table de preuves.",
  },
];

const NON_CANONICAL_BY_KEY = new Map(NON_CANONICAL_KEYS.map((k) => [k.key, k]));

/** Une autorité citable pour un mint. Jamais « on le sait ». */
export interface MintAuthority {
  /** Fichier, table ou capture. Doit pouvoir être rouvert par un tiers. */
  source: string;
  /** Ce qu'on y lit exactement. */
  states: string;
}

export interface SubjectIdentity {
  /** Identifiant opaque du sujet dans la comparaison. */
  subjectRef: string;
  label: string;
  /** L'identité on-chain. UNE seule, et elle est démontrée. */
  canonicalMint: string;
  chain: "solana";
  authorities: readonly MintAuthority[];
}

export const SUBJECT_IDENTITIES: readonly SubjectIdentity[] = [
  {
    subjectRef: "CASE-2025-VINE-001",
    label: "VINE",
    canonicalMint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump",
    chain: "solana",
    authorities: [
      {
        source: "src/data/vine-osint.json · vine-insider-network.json · vine-smoking-guns.json · vine-telegram-analysis.json",
        states: "case_meta.mint, identique dans les quatre fichiers du dossier",
      },
      {
        source: "scripts/osint/out-vine-{maxdepth,hop3,insiders-trace,qteam}.json",
        states: "champ `mint` des quatre traces on-chain réelles",
      },
      {
        source: "ep-square-band › ExitEvent (lecture seule, 2026-09-05)",
        states: "458 lignes sur 458 portent ce mint, et aucun autre",
      },
      {
        source: "ep-square-band › CoExitQualification (lecture seule, 2026-09-05)",
        states: "6 groupes, contextRef = CASE-2025-VINE-001",
      },
    ],
  },
  {
    subjectRef: "CASE-2024-BOTIFY-001",
    label: "BOTIFY",
    canonicalMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
    chain: "solana",
    authorities: [
      {
        source: "src/lib/kol/proceeds.ts › CA_MAP",
        states: "BOTIFY, BOTIFY-MAIN et SERIAL-12RUGS pointent tous trois dessus",
      },
      {
        source: "src/lib/token-resolution/v3/__fixtures__/dexscreener.mint.BOTIFY.json",
        states:
          "baseToken.address de la paire Raydium BourCfkdGsr55XAVzDeU6tci7twRTiCGRvCLioENnBBX",
      },
      {
        source: "src/lib/token-resolution/v3/__tests__/doctrinalCorpus.ts › LIVE",
        states: "déclaré « contrats réels » par le corpus doctrinal du Resolver",
      },
      {
        source: "scripts/osint/out-botify-david-trace.json",
        states: "154 signatures inspectées, 11 mouvements, txHash opposables",
      },
      {
        source: "ep-square-band › ShillEvent + KolTokenLink (lecture seule, 2026-09-05)",
        states: "5 + 5 lignes, toutes sur ce mint ; 0 ligne sur la clé de route",
      },
    ],
  },
];

const BY_REF = new Map(SUBJECT_IDENTITIES.map((s) => [s.subjectRef, s]));
const CANONICAL_MINTS = new Set(SUBJECT_IDENTITIES.map((s) => s.canonicalMint));

export class SyntheticMintError extends Error {
  constructor(key: string, entry: NonCanonicalKey, where: string) {
    super(
      `[similarity] « ${key} » n'est PAS un mint (${where}) : c'est une ` +
        `${entry.kind}. ${entry.why}\n` +
        `  Utilisée par : ${entry.usedBy.join(", ")}\n` +
        `Elle se décode pourtant en 32 octets base58, comme un vrai pubkey : ` +
        `aucune vérification de forme ne l'aurait arrêtée. Seule cette table le peut.`,
    );
    this.name = "SyntheticMintError";
  }
}

export class UnknownSubjectError extends Error {
  constructor(what: string, where: string) {
    super(
      `[similarity] sujet ou mint non déclaré « ${what} » (${where}). ` +
        `L'identité d'un sujet ne se devine pas : elle est résolue en amont, ` +
        `citée par ses autorités, et écrite dans SUBJECT_IDENTITIES.`,
    );
    this.name = "UnknownSubjectError";
  }
}

/**
 * ██ LA GARDE. ██ Refuse une clé connue pour ne pas être un mint, puis refuse
 * tout mint qui n'est pas celui d'un sujet déclaré.
 *
 * Elle LÈVE plutôt qu'elle ne rend `false` : une comparaison bâtie sur une clé
 * synthétique serait parfaitement bien formée, et c'est précisément ce qui la
 * rendrait indétectable en aval.
 */
export function assertCanonicalMint(mint: string, where = "assertCanonicalMint"): string {
  const bad = NON_CANONICAL_BY_KEY.get(mint);
  if (bad) throw new SyntheticMintError(mint, bad, where);
  if (!CANONICAL_MINTS.has(mint)) throw new UnknownSubjectError(mint, where);
  return mint;
}

/** Résout un sujet par sa référence, en revalidant son mint au passage. */
export function subjectIdentity(subjectRef: string, where = "subjectIdentity"): SubjectIdentity {
  const s = BY_REF.get(subjectRef);
  if (!s) throw new UnknownSubjectError(subjectRef, where);
  assertCanonicalMint(s.canonicalMint, where);
  return s;
}
