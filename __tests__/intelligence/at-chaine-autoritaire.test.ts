// ─── AT — L'ÉCRIVAIN DE CHAÎNE ET LA RÉPARATION DES 86 : CORPUS ADVERSE ────
//
// ██  La forme d'une adresse ne dit pas sa chaîne. Elle en suggère une.    ██
//
// ─── La cause racine, mesurée dans le source ──────────────────────────────
//
// `src/lib/intelligence/sources/ofac.ts:36`
//     return match ? match[1].toUpperCase() : "ETH";
//
// Quand l'`idType` OFAC ne correspond pas au motif, `extractCurrencyType`
// rend `"ETH"` — que `mapChain` transforme en `"ethereum"`. L'autorité n'a
// rien dit ; le code a REMPLI. C'est un littéral de repli au point d'écriture,
// et c'est de là que viennent les 86 lignes.
//
// Trois autres écrivains portent le même défaut sous deux formes :
//   forta.ts:103        chain: entity.startsWith("0x") ? "ethereum" : undefined
//   scamsniffer.ts:54   idem
//   goplus.ts:60,157    chain: string = "ethereum"      ← littéral par défaut
// Seul `ofac.ts:75` DÉRIVE (`mapChain(currencyType)`) — et son dérivé est
// empoisonné en amont par le repli de la ligne 36.
//
// ─── LE PIÈGE CENTRAL — et il n'est pas hypothétique ──────────────────────
//
// Réparer par INFÉRENCE DE FORME donnerait la bonne réponse sur les 79 TRON et
// une FAUSSE IDENTITÉ ailleurs. Mesuré le 2026-09-09 avec
// `inferAddressShape` de token-resolution/v3 :
//
//   1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa   (Bitcoin P2PKH) → kind=sol   chaîne=SOL
//   3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy   (Bitcoin P2SH)  → kind=sol   chaîne=SOL
//   bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq (bech32)  → kind=none  chaîne=null
//   TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t   (TRON)          → kind=tron  chaîne=TRON
//   0xa0b86991…eb48                      (EVM)           → kind=evm   chaîne=null
//
// Une réparation par la forme étiquetterait donc les 7 adresses Bitcoin en
// « solana » — elle remplacerait une fausse identité par une autre — et ne
// pourrait JAMAIS trancher entre ETH, BSC, BASE et ARBITRUM, parce que la
// forme EVM refuse d'inférer (`evmAmbiguous`). Ce n'est pas une réserve de
// principe : ce sont cinq mesures.
//
// ─── Contrainte de schéma, relevée en AX ──────────────────────────────────
//
// `SourceObservation` n'a AUCUNE clé étrangère vers `IngestionBatch` : le lien
// passe par `IngestionBatch.sourceId → SourceRegistry.id` et par
// `SourceObservation.sourceSlug` rejoignant `SourceRegistry.handle` PAR UNE
// CHAÎNE DE CARACTÈRES. Si l'autorité de chaîne remonte à un lot d'ingestion,
// elle doit être ÉTABLIE EN AMONT et passée comme un FAIT — jamais
// reconstruite dans le prédicat.
//
// ─── ATTRIBUABILITÉ — largeur mesurée avant de compter un mutant ──────────
//
// 33 mutants, six axes.
//
//   PRÉCIS (1)   E1 · E3 · E4 · P1 · P2b · P4 · A3-1c · A3-3
//   COUPLÉS (2)  E5 — répondre « ethereum » à une autorité muette EST le
//                littéral (E2) ; P2 — ne réparer que TRON manque le lot ET le
//                piège EVM
//   LARGES       E2 (5) — l'écrivain qui répond « ethereum » à tout casse les
//                cinq propriétés ; P3 (3) — une réparation par la forme écrit
//                de mauvaises valeurs ET manque des lignes, les deux réellement
//
//   AXE 3        A3-2 (4) et A3-1 (5) sont LARGES à raison : rendre une chaîne
//                au lieu d'un verdict détruit tout le codomaine, et répondre
//                INDECIDABLE à tout casse aussi la borne COMPATIBLE.
//   AXE 4        les quatre sont à largeur 2, et c'est STRUCTUREL : un
//                classificateur binaire n'a que deux sorties, donc toute
//                erreur d'assignation fait tomber deux critères à la fois.
//                Je le dis plutôt que de revendiquer une précision que la
//                forme du problème interdit.
//   NON-RÉGR.    NR-3 (4) est large À RAISON : le motif `0x ⇒ ethereum`
//                appliqué à un token id Hyperliquid viole les quatre critères
//                d'un seul geste. NR-1, NR-2, NR-4 sont à 2, couplés par
//                construction.
//   REMPLACEMENT PRÉCIS R2 · R1b · R4b · R1 (5), R4 (6) larges à raison —
//                accepter tout ou refuser tout casse l'invariant entier.
//   ÉCRIVAINS    les trois chemins non corrigés — forta/scamsniffer (4 et 3),
//                goplus (2) — sont larges parce que le défaut réel l'est :
//                `startsWith("0x") ? "ethereum" : undefined` viole la
//                dérivation, la forme, la famille EVM et l'absence typée
//                d'un seul geste.
//
// SIX critères ou mutants ont dû être RESSERRÉS pour que chacun meure du sien.
// Les deux derniers, ajoutés avec les chantiers 1 et 2 :
//   · la sonde R1b passait `null` en autorité existante — le mutant R5 y
//     mourait. Elle passe désormais une autorité réelle.
//   · le mutant goplus émettait « base », une chaîne EVM — il mourait aussi
//     sur NR-4. Il émet un littéral NON-EVM : la faute visée est le littéral,
//     pas sa famille.
//
// QUATRE critères l'avaient été en `71c894f` :
//   · P2 était un COMPTE EXACT — le mutant d'ÉLARGISSEMENT y mourait aussi.
//     Reformulé en sous-ensemble ; P1 garde l'autre sens.
//   · P3 jugeait des lignes ABSENTES — un rétrécissement y mourait par
//     absence, pas par mauvaise valeur. Il ne juge plus que les lignes écrites.
//   · P2b répétait P2 sur les deux familles. Il vise désormais le seul piège
//     EVM, la ligne qu'une réparation par la forme manque nécessairement.
//   · le mutant d'élargissement INVENTAIT une valeur (`?? "unknown"`) et
//     mourait sur P3. Il réécrit désormais des lignes déjà correctes avec leur
//     propre autorité.

import { describe, it, expect } from "vitest";
import { inferAddressShape } from "@/lib/token-resolution/v3/address";
import { MEASUREMENT_STATES } from "@/lib/publication/absenceVocabulary";

// ═══ AXE 1 — L'ÉCRIVAIN ══════════════════════════════════════════════════

/** Ce que la SOURCE déclare. `null` = elle n'a rien dit. */
interface AutoriteDeChaine {
  /** Valeur déclarée par l'enregistrement source, normalisée en amont. */
  chaineDeclaree: string | null;
}

type Ecriture =
  | { chain: string }
  | { chain: null; motif: "NO_CHAIN_AUTHORITY" };

type Ecrivain = (adresse: string, autorite: AutoriteDeChaine) => Ecriture;

const TEMOIN_ECRIVAIN: Ecrivain = (_adresse, autorite) =>
  autorite.chaineDeclaree === null
    ? { chain: null, motif: "NO_CHAIN_AUTHORITY" }
    : { chain: autorite.chaineDeclaree };

// ─── Adresses : les cinq formes mesurées ci-dessus ────────────────────────

const BTC_P2PKH = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
const BTC_BECH32 = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const EVM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

/**
 * CONSTRUITE — l'autorité dit `bsc`, la forme dit « EVM, je ne sais pas ».
 * Aucune ligne connue ne porte ce couple aujourd'hui ; elle existe pour que
 * la divergence forme/autorité soit exerçable sur la famille EVM, là où la
 * forme ne PEUT pas trancher.
 */
const CAS_BSC = { adresse: EVM, autorite: { chaineDeclaree: "bsc" } };

/** MESURÉE — divergence réelle : Bitcoin, dont la forme rend `sol`. */
const CAS_BITCOIN = { adresse: BTC_P2PKH, autorite: { chaineDeclaree: "bitcoin" } };

/** MESURÉE — la famille majoritaire des 86 : TRON. Forme et autorité coïncident. */
const CAS_TRON = { adresse: TRON, autorite: { chaineDeclaree: "tron" } };

/** L'autorité n'a rien déclaré — c'est le cas du repli `"ETH"` de la ligne 36. */
const CAS_MUET = { adresse: BTC_BECH32, autorite: { chaineDeclaree: null } };

function batterieEcrivain(impl: Ecrivain): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // E1 — la valeur écrite EST celle de l'autorité
  const tron = impl(CAS_TRON.adresse, CAS_TRON.autorite);
  dit("chain" in tron && tron.chain === "tron", "E1 valeur-non-derivee-de-l-autorite");

  // E2 — aucun littéral de repli
  const muet = impl(CAS_MUET.adresse, CAS_MUET.autorite);
  dit(!("chain" in muet) || muet.chain !== "ethereum", "E2 litteral-ethereum");

  // E3 — aucune inférence de forme : Bitcoin ne devient pas « solana »
  const btc = impl(CAS_BITCOIN.adresse, CAS_BITCOIN.autorite);
  dit("chain" in btc && btc.chain === "bitcoin", "E3 inference-de-forme");

  // E4 — la forme EVM ne PEUT pas trancher : l'autorité dit `bsc`, on écrit `bsc`
  const bsc = impl(CAS_BSC.adresse, CAS_BSC.autorite);
  dit("chain" in bsc && bsc.chain === "bsc", "E4 famille-evm-devinee");

  // E5 — l'absence d'autorité est TYPÉE, jamais devinée
  dit(
    muet.chain === null && (muet as { motif?: string }).motif === "NO_CHAIN_AUTHORITY",
    "E5 absence-non-typee",
  );

  return v;
}

// ═══ AXE 2 — LE PRÉDICAT DE SÉLECTION DES 86 ═════════════════════════════

interface Ligne {
  id: string;
  /** Ce que la colonne porte AUJOURD'HUI. */
  chain: string | null;
  address: string;
  /** L'autorité, établie EN AMONT et passée comme un fait. */
  autorite: AutoriteDeChaine;
}

interface EcritureReparation { id: string; colonne: string; valeur: string | null }
type Reparation = (lignes: readonly Ligne[]) => EcritureReparation[];

const ligne = (id: string, chain: string | null, address: string, declaree: string | null): Ligne =>
  ({ id, chain, address, autorite: { chaineDeclaree: declaree } });

/** MESURÉ — 79 TRON étiquetées `ethereum`. */
const LOT_TRON = Array.from({ length: 79 }, (_, i) =>
  ligne(`tron-${i}`, "ethereum", TRON, "tron"));

/** MESURÉ — 7 Bitcoin étiquetées `ethereum`. */
const LOT_BTC = Array.from({ length: 7 }, (_, i) =>
  ligne(`btc-${i}`, "ethereum", i % 2 === 0 ? BTC_P2PKH : BTC_BECH32, "bitcoin"));

/** Des lignes CORRECTEMENT étiquetées `ethereum`. Elles ne doivent pas bouger. */
const HORS_LOT = Array.from({ length: 12 }, (_, i) =>
  ligne(`eth-${i}`, "ethereum", EVM, "ethereum"));

/**
 * CONSTRUITE — étiquetée `ethereum`, adresse de FORME EVM, autorité `bsc`.
 * Elle appartient au lot par l'autorité, et une réparation par la forme la
 * MANQUERAIT : la forme EVM ne distingue pas ETH de BSC.
 */
const PIEGE_BSC = [ligne("bsc-1", "ethereum", EVM, "bsc")];

/** CONSTRUITE — autorité muette : hors lot, car rien n'autorise à écrire. */
const AUTORITE_MUETTE = [ligne("mute-1", "ethereum", BTC_BECH32, null)];

const CORPUS: Ligne[] = [...LOT_TRON, ...LOT_BTC, ...HORS_LOT, ...PIEGE_BSC, ...AUTORITE_MUETTE];

const TEMOIN_REPARATION: Reparation = (lignes) =>
  lignes
    .filter((l) => {
      const d = l.autorite.chaineDeclaree;
      return d !== null && l.chain !== d;
    })
    .map((l) => ({ id: l.id, colonne: "chain", valeur: l.autorite.chaineDeclaree }));

function batterieReparation(impl: Reparation): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  const w = impl(CORPUS);
  const ids = new Set(w.map((x) => x.id));

  // P1 — aucun élargissement : les lignes correctes ne sont pas touchées
  dit(
    HORS_LOT.every((l) => !ids.has(l.id)) && !ids.has("mute-1"),
    "P1 predicat-elargi",
  );

  // P2 — aucun rétrécissement. Formulé en SOUS-ENSEMBLE, pas en compte exact :
  // un compte exact aurait fait mourir le mutant d'ÉLARGISSEMENT sur ce
  // critère-ci, qui n'est pas le sien. P1 garde l'autre sens.
  dit(
    [...LOT_TRON, ...LOT_BTC].every((l) => ids.has(l.id)),
    "P2 predicat-retreci",
  );
  // P2b vise le PIÈGE BSC, et lui seul : c'est la ligne qu'une réparation par
  // la forme manque nécessairement, puisque la forme EVM ne distingue pas ETH
  // de BSC. Première rédaction : les deux familles — c'était P2 réécrit.
  dit(ids.has("bsc-1"), "P2b piege-evm-manque");

  // P3 — la valeur écrite vient de L'AUTORITÉ, pas de la forme. On ne juge que
  // les lignes RÉELLEMENT écrites : une ligne manquante est un défaut de
  // périmètre (P2), pas de valeur. Sans cette restriction, le mutant de
  // rétrécissement mourait aussi ici.
  dit(
    w.every((x) => {
      const l = CORPUS.find((c) => c.id === x.id);
      return l ? x.valeur === l.autorite.chaineDeclaree : true;
    }),
    "P3 valeur-derivee-de-la-forme",
  );

  // P4 — une seule colonne est écrite
  dit(w.every((x) => x.colonne === "chain"), "P4 autre-colonne-ecrite");

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("AT/0 — les deux batteries sont satisfiables", () => {
  it("les TÉMOINS passent", () => {
    expect(batterieEcrivain(TEMOIN_ECRIVAIN)).toEqual([]);
    expect(batterieReparation(TEMOIN_REPARATION)).toEqual([]);
  });

  it("le piège de la forme est RÉEL — mesuré, pas supposé", () => {
    // Si `inferAddressShape` cessait de rendre `sol` sur une adresse Bitcoin,
    // le mutant E3 ne prouverait plus rien. On épingle la mesure.
    expect(inferAddressShape(BTC_P2PKH).inferredChain).toBe("SOL");
    expect(inferAddressShape(BTC_BECH32).kind).toBe("none");
    expect(inferAddressShape(EVM).evmAmbiguous).toBe(true);
    expect(inferAddressShape(EVM).inferredChain).toBeNull();
    expect(inferAddressShape(TRON).inferredChain).toBe("TRON");
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

/** L'inférence de forme, telle qu'un correctif « évident » l'écrirait. */
const parLaForme = (adresse: string): string | null => {
  const f = inferAddressShape(adresse);
  return f.inferredChain ? f.inferredChain.toLowerCase() : null;
};

const MUTANTS_ECRIVAIN: Array<{ nom: string; critere: string; impl: Ecrivain }> = [
  {
    nom: "██ E0 — l'écrivain répond « ethereum » à tout",
    critere: "E2 litteral-ethereum",
    impl: () => ({ chain: "ethereum" }),
  },
  {
    nom: "le repli de la ligne 36 — autorité muette ⇒ « ethereum »",
    critere: "E5 absence-non-typee",
    impl: (a, aut) =>
      aut.chaineDeclaree === null ? { chain: "ethereum" } : TEMOIN_ECRIVAIN(a, aut),
  },
  {
    nom: "██ la dérivation est remplacée par l'INFÉRENCE DE FORME",
    critere: "E3 inference-de-forme",
    impl: (a, aut) => {
      const f = parLaForme(a);
      return f ? { chain: f } : TEMOIN_ECRIVAIN(a, aut);
    },
  },
  {
    nom: "la forme EVM est devinée « ethereum » faute de mieux",
    critere: "E4 famille-evm-devinee",
    impl: (a, aut) =>
      inferAddressShape(a).kind === "evm" ? { chain: "ethereum" } : TEMOIN_ECRIVAIN(a, aut),
  },
  {
    nom: "la valeur est dérivée d'autre chose que l'autorité (préfixe de l'adresse)",
    critere: "E1 valeur-non-derivee-de-l-autorite",
    impl: (a, aut) =>
      a.startsWith("T") ? { chain: "tronix" } : TEMOIN_ECRIVAIN(a, aut),
  },

  // ─── LES TROIS AUTRES ÉCRIVAINS, non corrigés à ce jour ────────────────
  // T1 n'a fermé qu'`ofac.ts`. Ces mutants reproduisent LITTÉRALEMENT les
  // trois chemins restants, pour que le corpus soit prêt quand la classe
  // sera fermée. Rien n'est corrigé dans ces fichiers : corpus seulement.
  {
    nom: "forta.ts:103 / scamsniffer.ts:54 — `startsWith(\"0x\") ? \"ethereum\" : undefined`, côté EVM",
    critere: "E4 famille-evm-devinee",
    impl: (a) =>
      a.startsWith("0x")
        ? { chain: "ethereum" }
        : ({ chain: undefined } as unknown as Ecriture),
  },
  {
    nom: "forta.ts:103 / scamsniffer.ts:54 — le même chemin, côté NON-EVM : `undefined` nu",
    critere: "E5 absence-non-typee",
    impl: (a, aut) =>
      a.startsWith("0x")
        ? TEMOIN_ECRIVAIN(a, aut)
        : ({ chain: undefined } as unknown as Ecriture),
  },
  {
    nom: "goplus.ts:60 et :157 — `chain: string = \"ethereum\"` en défaut de paramètre",
    critere: "E2 litteral-ethereum",
    impl: (a, aut) => (aut.chaineDeclaree === null ? { chain: "ethereum" } : TEMOIN_ECRIVAIN(a, aut)),
  },
];

const MUTANTS_REPARATION: Array<{ nom: string; critere: string; impl: Reparation }> = [
  {
    nom: "██ le prédicat est ÉLARGI — toute ligne `ethereum` est réécrite",
    critere: "P1 predicat-elargi",
    // Il n'INVENTE aucune valeur : il réécrit des lignes DÉJÀ correctes avec
    // leur propre autorité. Sans cette précaution il mourait aussi sur P3,
    // un critère qui n'est pas le sien.
    impl: (l) =>
      l.filter((x) => x.chain === "ethereum" && x.autorite.chaineDeclaree !== null)
        .map((x) => ({ id: x.id, colonne: "chain", valeur: x.autorite.chaineDeclaree })),
  },
  {
    nom: "██ le prédicat est RÉTRÉCI — seules les adresses TRON sont réparées",
    critere: "P2 predicat-retreci",
    impl: (l) => TEMOIN_REPARATION(l).filter((x) => x.valeur === "tron"),
  },
  {
    nom: "le piège EVM est manqué — la ligne BSC reste étiquetée ethereum",
    critere: "P2b piege-evm-manque",
    impl: (l) => TEMOIN_REPARATION(l).filter((x) => x.id !== "bsc-1"),
  },
  {
    nom: "██ la base autoritaire est remplacée par la FORME D'ADRESSE",
    critere: "P3 valeur-derivee-de-la-forme",
    impl: (l) =>
      l.filter((x) => {
        const f = parLaForme(x.address);
        return f !== null && x.chain !== f;
      }).map((x) => ({ id: x.id, colonne: "chain", valeur: parLaForme(x.address) })),
  },
  {
    nom: "une COLONNE AUTRE que `chain` est écrite",
    critere: "P4 autre-colonne-ecrite",
    impl: (l) =>
      TEMOIN_REPARATION(l).map((x) => ({ ...x, colonne: x.id.startsWith("btc-") ? "riskClass" : x.colonne })),
  },
];

describe("AT/1 — écrivain : chaque mutant meurt sur sa propriété", () => {
  for (const m of MUTANTS_ECRIVAIN) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieEcrivain(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

describe("AT/2 — réparation : chaque mutant meurt sur sa propriété", () => {
  for (const m of MUTANTS_REPARATION) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieReparation(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }







  it("les 33 mutants sont déclarés, et chacun porte un critère", () => {
    // L'UNICITÉ des critères n'est PAS exigée : trois chemins d'écriture
    // distincts — forta, scamsniffer, goplus — commettent la même faute, et
    // les distinguer par leur ORIGINE a plus de valeur que de les fondre.
    // Ce qui reste exigé, et vérifié mutant par mutant ci-dessus, c'est que
    // chacun meure du critère qu'il déclare.
    const tous = [
      ...MUTANTS_ECRIVAIN, ...MUTANTS_REPARATION,
      ...MUTANTS_VERIFICATEUR, ...MUTANTS_CLASSIFICATEUR,
      ...MUTANTS_NON_REGRESSION, ...MUTANTS_REMPLACEMENT,
    ];
    expect(tous).toHaveLength(33);
    expect(tous.every((m) => m.critere.length > 0)).toBe(true);
  });
});

// ═══ AXE 3 — EXCLUSION ≠ ÉLECTION ════════════════════════════════════════
//
// La forme ne peut pas ÉLIRE une chaîne (axe 1). Mais elle en EXCLUT une :
// `EVM_ADDRESS_RE` ne matche ni une base58 Bitcoin, ni une adresse TRON. Une
// ligne étiquetée `ethereum` portant une adresse non-EVM est donc CONTREDITE
// par sa propre forme — et le dire n'est pas deviner.
//
// Les deux bornes doivent tenir ensemble. N'en tenir qu'une autorise soit le
// défaut d'origine (« la forme ne dit rien, gardons ethereum »), soit sa
// symétrie (« pas EVM, donc TRON »).

type VerdictDeForme = "CONTREDITE" | "COMPATIBLE" | "INDECIDABLE";
type Verificateur = (adresse: string, chaineEcrite: string | null) => VerdictDeForme;

const FAMILLE_EVM = new Set(["ethereum", "bsc", "base", "arbitrum"]);

const TEMOIN_VERIFICATEUR: Verificateur = (adresse, chaineEcrite) => {
  if (chaineEcrite === null || !FAMILLE_EVM.has(chaineEcrite)) return "INDECIDABLE";
  // La cible est EVM : la forme peut CONTREDIRE, ou être compatible. Elle ne
  // peut jamais désigner LAQUELLE des chaînes EVM — c'est l'axe 1.
  return inferAddressShape(adresse).kind === "evm" ? "COMPATIBLE" : "CONTREDITE";
};

function batterieVerificateur(impl: Verificateur): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // A3-1 — l'exclusion EST appliquée : non-EVM sur une chaîne EVM = contredite
  dit(impl(TRON, "ethereum") === "CONTREDITE", "A3-1 exclusion-non-appliquee");
  dit(impl(BTC_P2PKH, "ethereum") === "CONTREDITE", "A3-1b exclusion-bitcoin-non-appliquee");
  dit(impl(BTC_BECH32, "ethereum") === "CONTREDITE", "A3-1c exclusion-bech32-non-appliquee");

  // A3-2 — l'exclusion n'ÉLIT pas : le codomaine ne contient aucune chaîne
  const sorties = [
    impl(TRON, "ethereum"), impl(BTC_P2PKH, "ethereum"),
    impl(EVM, "ethereum"), impl(TRON, null), impl(EVM, "bsc"),
  ];
  dit(
    sorties.every((x) => ["CONTREDITE", "COMPATIBLE", "INDECIDABLE"].includes(x)),
    "A3-2 exclusion-devenue-election",
  );

  // A3-3 — SUR-CORRECTION : une forme EVM sur une chaîne EVM n'est PAS contredite
  dit(impl(EVM, "ethereum") === "COMPATIBLE", "A3-3 evm-contredite-a-tort");
  dit(impl(EVM, "bsc") === "COMPATIBLE", "A3-3b evm-sur-bsc-contredite");

  // A3-4 — hors famille EVM, la forme ne conclut pas
  dit(impl(TRON, "tron") === "INDECIDABLE", "A3-4 conclusion-hors-perimetre");

  return v;
}

const MUTANTS_VERIFICATEUR: Array<{ nom: string; critere: string; impl: Verificateur }> = [
  {
    nom: "██ l'exclusion devient une ÉLECTION — « pas EVM, donc TRON »",
    critere: "A3-2 exclusion-devenue-election",
    impl: (a, c) => {
      const r = TEMOIN_VERIFICATEUR(a, c);
      return r === "CONTREDITE"
        ? ((inferAddressShape(a).inferredChain ?? "TRON") as unknown as VerdictDeForme)
        : r;
    },
  },
  {
    nom: "██ l'exclusion est REFUSÉE — « la forme ne dit rien, gardons ethereum »",
    critere: "A3-1 exclusion-non-appliquee",
    impl: () => "INDECIDABLE",
  },
  {
    nom: "l'exclusion ne couvre pas le bech32, que la V3 rend `kind: none`",
    critere: "A3-1c exclusion-bech32-non-appliquee",
    impl: (a, c) =>
      inferAddressShape(a).kind === "none" ? "INDECIDABLE" : TEMOIN_VERIFICATEUR(a, c),
  },
  {
    nom: "SUR-CORRECTION — toute ligne `ethereum` est déclarée contredite",
    critere: "A3-3 evm-contredite-a-tort",
    impl: (a, c) => (c === "ethereum" ? "CONTREDITE" : TEMOIN_VERIFICATEUR(a, c)),
  },
];

describe("AT/3 — exclusion ≠ élection", () => {
  it("le TÉMOIN passe", () => expect(batterieVerificateur(TEMOIN_VERIFICATEUR)).toEqual([]));
  for (const m of MUTANTS_VERIFICATEUR) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieVerificateur(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

// ═══ AXE 4 — LES DEUX POPULATIONS D'ABSENCE ══════════════════════════════
//
// Après réparation en NULL, les 86 rejoignent 14 lignes déjà à NULL (rejeu
// mesuré : undefined 14 → 100). Les deux n'ont PAS la même histoire :
//
//   14 — aucun code de devise enregistré : l'autorité n'a JAMAIS rien dit
//   86 — l'OFAC a dit « USDT » : l'autorité a PARLÉ, mais pas sur cette
//        dimension. La chaîne n'est pas dérivable de ce qu'elle a dit.
//
// ─── Ce qui est dérivable, et ce qui ne l'est PAS ─────────────────────────
//
// DÉRIVABLE : `ofac.ts:81` écrit `meta: { currencyType }`, et `ingest.ts`
// (775, 796, 828) persiste ce `meta` sur `SourceObservation`. Le fait existe
// donc en base — sur une AUTRE TABLE que la ligne réparée, et il doit être
// établi en amont, comme en AX.
//
// ██ NON STOCKABLE — TROU DE PREUVE DÉCLARÉ ██
// `CanonicalEntity` ne porte AUCUNE colonne de motif : mesuré, ses colonnes
// sont id · type · value · chain · riskClass · strongestSource · sourceCount ·
// firstSeenAt · lastSeenAt · dedupKey · displaySafety · reviewedBy ·
// reviewedAt · isActive · deactivatedAt · createdAt · updatedAt. Écrire
// `chain = NULL` EFFONDRE donc les deux populations de façon irréversible sur
// la ligne réparée.
//
// La batterie ci-dessous juge un CLASSIFICATEUR à qui le fait est passé — elle
// prouve que la distinction est calculable. Elle ne prouve PAS qu'elle survit
// à l'écriture : préserver la distinction exige d'écrire HORS de la colonne
// `chain`, et c'est une décision de schéma qui n'est ni à moi ni à T1.

type EtatAbsence = "NOT_MEASURED" | "NOT_MEASURABLE";
type Classificateur = (l: { codeDeviseEnregistre: string | null }) => EtatAbsence;

const TEMOIN_CLASSIFICATEUR: Classificateur = (l) =>
  l.codeDeviseEnregistre === null ? "NOT_MEASURED" : "NOT_MEASURABLE";

/** MESURÉ — les 14 : aucun code de devise n'a jamais été enregistré. */
const POP_14 = { codeDeviseEnregistre: null };
/** MESURÉ — les 86 : l'OFAC a répondu « USDT », hors dimension chaîne. */
const POP_86 = { codeDeviseEnregistre: "USDT" };

function batterieClassificateur(impl: Classificateur): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  dit(impl(POP_14) !== impl(POP_86), "A4-1 populations-effondrees");
  dit(impl(POP_86) !== "NOT_MEASURED", "A4-2 not-measured-la-ou-l-autorite-a-repondu");
  dit(impl(POP_14) !== "NOT_MEASURABLE", "A4-3 not-measurable-la-ou-rien-n-a-ete-dit");
  dit(
    [impl(POP_14), impl(POP_86)].every((e) =>
      (MEASUREMENT_STATES as readonly string[]).includes(e)),
    "A4-4 vocabulaire-hors-absenceVocabulary",
  );
  return v;
}

const MUTANTS_CLASSIFICATEUR: Array<{ nom: string; critere: string; impl: Classificateur }> = [
  {
    nom: "██ les deux populations sont traitées comme UNE SEULE",
    critere: "A4-1 populations-effondrees",
    impl: () => "NOT_MEASURED",
  },
  {
    nom: "██ NOT_MEASURED là où l'autorité a RÉPONDU, hors dimension",
    critere: "A4-2 not-measured-la-ou-l-autorite-a-repondu",
    impl: (l) => (l.codeDeviseEnregistre === null ? "NOT_MEASURABLE" : "NOT_MEASURED"),
  },
  {
    nom: "SUR-CORRECTION — NOT_MEASURABLE là où rien n'a jamais été dit",
    critere: "A4-3 not-measurable-la-ou-rien-n-a-ete-dit",
    impl: () => "NOT_MEASURABLE",
  },
  {
    nom: "un jeton hors du vocabulaire d'absence ratifié",
    critere: "A4-4 vocabulaire-hors-absenceVocabulary",
    impl: () => "NO_CHAIN" as EtatAbsence,
  },
];

describe("AT/4 — deux populations d'absence, une seule colonne", () => {
  it("le TÉMOIN passe", () => expect(batterieClassificateur(TEMOIN_CLASSIFICATEUR)).toEqual([]));

  it("TROU DE PREUVE DÉCLARÉ — la distinction n'est pas stockable sur la ligne réparée", () => {
    // On épingle le fait, pas une intention : aucune colonne de
    // `CanonicalEntity` ne peut porter le motif d'absence. Si une colonne
    // apparaissait, ce test rougirait et la déclaration serait à revoir.
    const colonnes = [
      "id", "type", "value", "chain", "riskClass", "strongestSource", "sourceCount",
      "firstSeenAt", "lastSeenAt", "dedupKey", "displaySafety", "reviewedBy",
      "reviewedAt", "isActive", "deactivatedAt", "createdAt", "updatedAt",
    ];
    expect(colonnes.filter((c) => /reason|nature|absence|state|why/i.test(c))).toEqual([]);
  });

  for (const m of MUTANTS_CLASSIFICATEUR) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieClassificateur(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

// ═══ CHANTIER 1 — PREUVE DE NON-RÉGRESSION DES TROIS ÉCRIVAINS ═══════════
//
// Ruling : « Zéro ligne / chemin non armé → backlog + PREUVE DE NON-RÉGRESSION. »
//
// Les trois chemins ne produisent aucune ligne fausse aujourd'hui — et
// uniquement parce que `0x`+40hex serait exclusif à l'EVM. Ce témoin rougit le
// jour où l'accident cesse.
//
// ██ L'ACCIDENT A DÉJÀ CESSÉ POUR UNE FAMILLE. Mesuré dans
// `token-resolution/v3/address.ts` :
//     EVM_ADDRESS_RE     = /^0x[a-fA-F0-9]{40}$/
//     HYPER_TOKEN_ID_RE  = /^0x[a-fA-F0-9]{32}$/
// Un token id Hyperliquid fait 34 caractères, COMMENCE PAR `0x`, et
// `inferAddressShape` le rend `kind: hyper_token_id, inferredChain: HYPER`.
// `startsWith("0x")` n'est donc PLUS un test EVM sûr : `forta.ts:103` et
// `scamsniffer.ts:54` écriraient « ethereum » sur un jeton Hyperliquid.
// Ce n'est pas un risque à venir, c'est une fissure existante.
//
// Second risque, nommé par T1 et non mesurable avec nos données : les 2 530
// lignes `scamsniffer` étiquetées « ethereum » peuvent contenir Base, BSC ou
// Arbitrum. La forme `0x`+40hex ne les individualise pas — `evmAmbiguous`
// vaut `true` et `inferredChain` vaut `null`. Nous ne pouvons pas mesurer
// l'erreur ; nous pouvons empêcher de la refabriquer.

const HYPER_TOKEN_ID = "0x" + "a".repeat(32);
const CHAINES_EVM_NOMMEES = ["ethereum", "bsc", "base", "arbitrum"];

function batterieNonRegression(impl: Ecrivain): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };
  const muette = { chaineDeclaree: null };

  // NR-1 — sans autorité, AUCUNE chaîne n'est émise, quelle que soit la forme
  const sansAutorite = [EVM, TRON, BTC_P2PKH, BTC_BECH32, HYPER_TOKEN_ID]
    .map((a) => impl(a, muette));
  dit(sansAutorite.every((e) => e.chain === null), "NR-1 emet-sans-autorite");

  // NR-2 — à autorité CONSTANTE, la forme ne change pas la valeur écrite
  const aut = { chaineDeclaree: "hyper" };
  const valeurs = new Set([EVM, HYPER_TOKEN_ID, TRON].map((a) => {
    const e = impl(a, aut);
    return "chain" in e ? String(e.chain) : "ABSENCE";
  }));
  dit(valeurs.size === 1, "NR-2 forme-influence-la-valeur");

  // NR-3 — ██ LA FISSURE — une forme `0x` NON-EVM ne reçoit pas une chaîne EVM
  const hyper = impl(HYPER_TOKEN_ID, { chaineDeclaree: "hyper" });
  dit(
    "chain" in hyper && hyper.chain === "hyper",
    "NR-3 forme-0x-non-evm-recoit-une-chaine-evm",
  );

  // NR-4 — aucune chaîne EVM NOMMÉE n'est émise sur une forme qui ne
  // l'individualise pas, quand l'autorité ne l'a pas nommée
  const ambigu = impl(EVM, muette);
  dit(
    !("chain" in ambigu && CHAINES_EVM_NOMMEES.includes(String(ambigu.chain))),
    "NR-4 chaine-evm-nommee-sans-individuation",
  );

  return v;
}

const MUTANTS_NON_REGRESSION: Array<{ nom: string; critere: string; impl: Ecrivain }> = [
  {
    nom: "██ forta.ts:103 / scamsniffer.ts:54 appliqué à un token id HYPERLIQUID",
    critere: "NR-3 forme-0x-non-evm-recoit-une-chaine-evm",
    impl: (a) =>
      a.startsWith("0x") ? { chain: "ethereum" } : ({ chain: null, motif: "NO_CHAIN_AUTHORITY" }),
  },
  {
    nom: "un écrivain nomme « ethereum » sur une forme EVM que rien n'individualise",
    critere: "NR-4 chaine-evm-nommee-sans-individuation",
    impl: (a, aut) =>
      aut.chaineDeclaree === null && inferAddressShape(a).kind === "evm"
        ? { chain: "ethereum" }
        : TEMOIN_ECRIVAIN(a, aut),
  },
  {
    // Le littéral choisi est NON-EVM à dessein : avec « base », le mutant
    // mourait aussi sur NR-4, qui vise les chaînes EVM nommées. La faute
    // visée ici est le littéral lui-même, pas sa famille.
    nom: "goplus.ts — le défaut de paramètre passe de « ethereum » à un AUTRE littéral",
    critere: "NR-1 emet-sans-autorite",
    impl: (a, aut) => (aut.chaineDeclaree === null ? { chain: "tron" } : TEMOIN_ECRIVAIN(a, aut)),
  },
  {
    nom: "la valeur écrite dépend de la FORME et non de l'autorité",
    critere: "NR-2 forme-influence-la-valeur",
    impl: (a, aut) =>
      inferAddressShape(a).kind === "tron" ? { chain: "tron" } : TEMOIN_ECRIVAIN(a, aut),
  },
];

describe("AT/5 — non-régression des trois écrivains non armés", () => {
  it("le TÉMOIN passe", () => expect(batterieNonRegression(TEMOIN_ECRIVAIN)).toEqual([]));

  it("MESURE ÉPINGLÉE — `startsWith(\"0x\")` n'est PAS un test EVM", () => {
    // Si cette mesure changeait, NR-3 cesserait de prouver quoi que ce soit.
    expect(HYPER_TOKEN_ID.startsWith("0x")).toBe(true);
    expect(inferAddressShape(HYPER_TOKEN_ID).kind).toBe("hyper_token_id");
    expect(inferAddressShape(HYPER_TOKEN_ID).inferredChain).toBe("HYPER");
    expect(inferAddressShape(EVM).kind).toBe("evm");
    expect(inferAddressShape(EVM).evmAmbiguous).toBe(true);
  });

  for (const m of MUTANTS_NON_REGRESSION) {
    it(`ATTRAPÉ — ${m.nom}`, () => {
      const viol = batterieNonRegression(m.impl);
      expect(viol, `NON ATTRAPÉ — ${m.nom}`).not.toEqual([]);
      expect(viol, `attrapé, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

// ═══ CHANTIER 2 — L'INVARIANT DE REMPLACEMENT ════════════════════════════
//
// Règle ratifiée : « Une propriété d'identité ne peut être remplacée que par
// une autorité sémantiquement COMPÉTENTE pour cette propriété, et au moins
// aussi FORTE que l'autorité existante. »
//
// Les deux conditions sont CUMULATIVES, et c'est la première qu'on oublie :
// l'OFAC atteste un JETON, pas une CHAÎNE. `CURRENCY_TO_CHAIN` dérivait une
// chaîne d'un code de devise — un cran AVANT la forme d'adresse dans le même
// raisonnement interdit. `USDT` est une autorité FORTE ; simplement pas sur
// cette dimension.
//
// La force n'est pas une échelle inventée : c'est `sourceTier`, déjà au
// schéma — 1 réglementaire, 2 technique. Plus petit = plus fort.

type Propriete = "chain" | "identity" | "token";
interface AutoriteNommee { nom: string; competences: Propriete[]; tier: 1 | 2 | 3 }
type DecisionRemplacement = "REMPLACE" | "REFUS_INCOMPETENTE" | "REFUS_PLUS_FAIBLE";
type Remplacement = (
  existante: AutoriteNommee | null, candidate: AutoriteNommee, p: Propriete,
) => DecisionRemplacement;

/** L'OFAC atteste une entité et un jeton. PAS une chaîne. */
const OFAC_DEVISE: AutoriteNommee = { nom: "ofac:currencyType", competences: ["token", "identity"], tier: 1 };
/** Le registre déclare une chaîne par défaut : compétent, technique. */
const REGISTRE: AutoriteNommee = { nom: "sourceRegistry:defaultChain", competences: ["chain"], tier: 2 };
/** Une paire de marché atteste la chaîne où elle est cotée. */
const MARCHE: AutoriteNommee = { nom: "market_pair", competences: ["chain"], tier: 2 };
/** Un enregistrement réglementaire qui déclare explicitement la chaîne. */
const REGLEMENTAIRE_CHAINE: AutoriteNommee = { nom: "ofac:declaredChain", competences: ["chain"], tier: 1 };
/** Le symbole : compétent sur rien. */
const SYMBOLE: AutoriteNommee = { nom: "symbol", competences: [], tier: 3 };

const TEMOIN_REMPLACEMENT: Remplacement = (existante, candidate, p) => {
  if (!candidate.competences.includes(p)) return "REFUS_INCOMPETENTE";
  if (existante && candidate.tier > existante.tier) return "REFUS_PLUS_FAIBLE";
  return "REMPLACE";
};

function batterieRemplacement(impl: Remplacement): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // R1 — une autorité INCOMPÉTENTE est refusée, quelle que soit sa force
  dit(impl(REGISTRE, OFAC_DEVISE, "chain") === "REFUS_INCOMPETENTE", "R1 incompetente-acceptee");
  // Sonde avec une autorité EXISTANTE non nulle : passer `null` ici faisait
  // mourir le mutant R5 sur ce critère-ci, qui n'est pas le sien.
  dit(impl(REGLEMENTAIRE_CHAINE, SYMBOLE, "identity") === "REFUS_INCOMPETENTE",
      "R1b symbole-comme-autorite");

  // R2 — une autorité PLUS FAIBLE est refusée, même compétente
  dit(impl(REGLEMENTAIRE_CHAINE, MARCHE, "chain") === "REFUS_PLUS_FAIBLE", "R2 plus-faible-acceptee");

  // R3 — ██ LE PIÈGE — vérifier la FORCE sans la COMPÉTENCE. `OFAC_DEVISE` est
  // tier 1, donc plus fort que le registre : un contrôle de force seul
  // l'accepterait. Le motif doit être l'INCOMPÉTENCE, pas autre chose.
  dit(impl(REGISTRE, OFAC_DEVISE, "chain") !== "REMPLACE", "R3 force-sans-competence");

  // R4 — SUR-CORRECTION : un candidat compétent et au moins aussi fort REMPLACE
  dit(impl(REGISTRE, REGLEMENTAIRE_CHAINE, "chain") === "REMPLACE", "R4 tout-remplacement-refuse");
  dit(impl(MARCHE, REGISTRE, "chain") === "REMPLACE", "R4b force-egale-refusee");

  // R5 — sans autorité existante, un candidat compétent remplace : il n'y a
  // rien à être « plus faible » que.
  dit(impl(null, MARCHE, "chain") === "REMPLACE", "R5 absence-d-existante-bloque");

  // R6 — les deux refus restent DISTINCTS
  const refus = new Set([
    impl(REGISTRE, OFAC_DEVISE, "chain"),
    impl(REGLEMENTAIRE_CHAINE, MARCHE, "chain"),
  ]);
  dit(refus.size === 2, "R6 motifs-aplatis");

  return v;
}

const MUTANTS_REMPLACEMENT: Array<{ nom: string; critere: string; impl: Remplacement }> = [
  {
    nom: "██ le contrôle porte sur la FORCE SEULE — USDT est fort, donc il passe",
    critere: "R3 force-sans-competence",
    impl: (e, c) => (e && c.tier > e.tier ? "REFUS_PLUS_FAIBLE" : "REMPLACE"),
  },
  {
    nom: "le contrôle porte sur la COMPÉTENCE seule — une autorité faible écrase une forte",
    critere: "R2 plus-faible-acceptee",
    impl: (_e, c, p) => (c.competences.includes(p) ? "REMPLACE" : "REFUS_INCOMPETENTE"),
  },
  {
    nom: "une autorité incompétente est acceptée (jeton → chaîne)",
    critere: "R1 incompetente-acceptee",
    impl: () => "REMPLACE",
  },
  {
    nom: "le symbole est traité comme une autorité d'identité",
    critere: "R1b symbole-comme-autorite",
    impl: (e, c, p) =>
      c.nom === "symbol" ? "REMPLACE" : TEMOIN_REMPLACEMENT(e, c, p),
  },
  {
    nom: "SUR-CORRECTION — tout remplacement est refusé",
    critere: "R4 tout-remplacement-refuse",
    impl: () => "REFUS_PLUS_FAIBLE",
  },
  {
    nom: "SUR-CORRECTION — la force ÉGALE est refusée (strictement plus fort exigé)",
    critere: "R4b force-egale-refusee",
    impl: (e, c, p) =>
      e && c.tier >= e.tier ? "REFUS_PLUS_FAIBLE" : TEMOIN_REMPLACEMENT(e, c, p),
  },
  {
    nom: "SUR-CORRECTION — l'absence d'autorité existante bloque le remplacement",
    critere: "R5 absence-d-existante-bloque",
    impl: (e, c, p) => (e === null ? "REFUS_PLUS_FAIBLE" : TEMOIN_REMPLACEMENT(e, c, p)),
  },
  {
    nom: "les deux motifs de refus sont APLATIS en un seul",
    critere: "R6 motifs-aplatis",
    impl: (e, c, p) => {
      const r = TEMOIN_REMPLACEMENT(e, c, p);
      return r === "REMPLACE" ? r : "REFUS_INCOMPETENTE";
    },
  },
];

describe("AT/6 — invariant de remplacement : compétence ET force", () => {
  it("le TÉMOIN passe", () => expect(batterieRemplacement(TEMOIN_REMPLACEMENT)).toEqual([]));
  for (const m of MUTANTS_REMPLACEMENT) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieRemplacement(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});
