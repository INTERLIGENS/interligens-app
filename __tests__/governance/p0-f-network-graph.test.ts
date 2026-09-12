// ─── P0 · F — LE GRAPHE : LE CONTENANT NE CONFÈRE PAS L'AUTORITÉ ─────────
//
// ██  « Protected/nominative content cannot acquire publication authority   ██
// ██    merely because it is embedded in a graph node, edge, label or note.»██
//
// Ce fichier tourne sur la charge RÉELLEMENT SERVIE — `scamUniverse.json`
// passé par `parseNetworkGraph`, exactement ce que
// `GET /api/investigators/network-graph` rend aujourd'hui derrière
// `enforceInvestigatorAccess()`, c'est-à-dire à l'audience bêta.

import { describe, it, expect } from "vitest";
import rawData from "@/data/scamUniverse.json";
import { parseNetworkGraph } from "@/lib/network/schema";
import {
  GROUPES_NOMINATIFS,
  SOURCE_NON_GOUVERNEE,
  contenirGraphe,
  estNominatif,
  type DecisionDeSujet,
} from "@/lib/governance/surfaces/networkGraph";

const SERVI = parseNetworkGraph(rawData as unknown);

/**
 * Les décisions RÉELLEMENT lisibles, mesurées sur ep-square-band le
 * 2026-09-12. C'est ce que la route lira par l'autorité de publication.
 *
 * Quatre des six `person` ont un profil publié. Deux d'entre elles portent un
 * `displayName` publié qui NE CORRESPOND PAS au label du graphe — et c'est le
 * cas que ce fichier existe pour attraper.
 */
// ⚠ AUCUNE entrée `kokoskib` ici, et ce n'est pas un oubli : le nœud porte
// `handle: "@KokoskiB"` alors que le profil publié s'appelle `bkokoski`. La
// carte est construite par la route depuis les handles de la BASE, donc
// `kokoskib` n'y figure pas. Le nœud n'est fondé que parce que la résolution
// essaie `handle` PUIS `id` — et ce test est le témoin de ce repli.
const DECISIONS = new Map<string, DecisionDeSujet>([
  ["bkokoski", { handle: "bkokoski", publishStatus: "published", displayName: "Brandon Kokoski" }],
  ["sxyz500", { handle: "sxyz500", publishStatus: "published", displayName: "Sxyz500" }],
  ["gordongekko", { handle: "GordonGekko", publishStatus: "published", displayName: "GordonGekko" }],
  ["planted", { handle: "planted", publishStatus: "published", displayName: "planted" }],
]);

const CONTENU = contenirGraphe(SERVI, DECISIONS);
const SERIALISE = JSON.stringify(CONTENU.graphe);

// ═══════════════════════════════════════════════════════════════════════════
// LE PRÉALABLE — le phénomène interdit existe dans la charge servie
// ═══════════════════════════════════════════════════════════════════════════

describe("TÉMOIN POSITIF — ce que la route sert AUJOURD'HUI", () => {
  it("le critère est le GROUPE DÉCLARÉ, et il en trouve plus qu'un grep", () => {
    const nominatifs = SERVI.nodes.filter(estNominatif);
    // Le premier inventaire cherchait des motifs de texte (« Mom », « Dad »,
    // « family ») et rendait 9. Le `group` déclaré en rend 13.
    expect(nominatifs.length).toBe(13);
    expect(SERVI.nodes.length).toBe(41);

    // Les quatre que le motif ne pouvait pas voir : des noms civils complets.
    const labels = nominatifs.map((n) => n.label);
    for (const nom of ["Sam O'Leary (SAMBO)", "Djordje Stupar", "Parth Kapadia", "Ryan Arriaga"]) {
      expect(labels, "un grep n'est pas une provenance").toContain(nom);
    }
  });

  it("six nœuds désignent des personnes par leur LIEN DE PARENTÉ, avec allocation", () => {
    const familles = SERVI.nodes.filter((n) => n.group === "wallet_family");
    expect(familles).toHaveLength(6);
    expect(familles.map((n) => n.label)).toEqual([
      "BK Mom (F&F 0.055%)",
      "BK Dad (F&F 0.055%)",
      "BK Carter (F&F 0.02%)",
      "BK Illya (F&F 0.05%)",
      "SAM Mum (F&F 0.05%)",
      "SAM Dad (F&F 0.07%)",
    ]);
    // Aucun n'a de handle : il n'existe aucun sujet gouverné à leur sujet, donc
    // aucune décision de publication ne PEUT exister. C'est un refus, pas une
    // qualification. (« BK Illya » n'est même pas un lien de parenté.)
    for (const f of familles) expect(f.handle).toBeUndefined();
  });

  it("les notes, la timeline et les metrics portent le même contenu protégé", () => {
    const brut = JSON.stringify(SERVI);
    expect(brut).toContain("Insider supply to BK Mom/Dad/Carter");
    expect(brut).toContain("213k GHOST dumped by SAM MUM in 3 minutes");
    expect(brut).toContain("BK Mom begins 10-week GHOST cashout");
    expect(brut).toContain("Djordje Stupar (@planted) admits");
    expect(brut).toContain("totalScammedUsd_bkokoski");
    expect(brut).toContain("INTERLIGENS prod DB");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE CONTAINMENT
// ═══════════════════════════════════════════════════════════════════════════

describe("LE CONTAINMENT — nœuds, arêtes, labels, notes, et les trois autres porteurs", () => {
  it("██ LE CAS QUI DÉCIDE DE LA RÈGLE — sujet PUBLIÉ, label NON COUVERT", () => {
    // `sxyz500` et `planted` sont publiés. Une garde qui aurait testé « ce
    // sujet est-il publié ? » les aurait laissés passer tous les deux — avec
    // « Sam O'Leary (SAMBO) » et « Djordje Stupar », deux noms civils que la
    // décision de publication ne couvre pas.
    const retires = new Map(CONTENU.retraits.map((r) => [r.id, r.motif]));
    expect(retires.get("sxyz500")).toBe("LABEL_NON_COUVERT_PAR_LA_DECISION");
    expect(retires.get("planted")).toBe("LABEL_NON_COUVERT_PAR_LA_DECISION");
    expect(SERIALISE).not.toContain("Sam O'Leary");
    expect(SERIALISE).not.toContain("Djordje Stupar");
  });

  it("les six nœuds de famille partent — AUCUN_SUJET_GOUVERNE", () => {
    const retires = new Map(CONTENU.retraits.map((r) => [r.id, r.motif]));
    for (const id of ["bk_fam_mom", "bk_fam_dad", "bk_fam_carter", "bk_fam_illya", "sam_fam_mum", "sam_fam_dad"]) {
      expect(retires.get(id), id).toBe("AUCUN_SUJET_GOUVERNE");
    }
    for (const motif of ["BK Mom", "BK Dad", "BK Carter", "BK Illya", "SAM Mum", "SAM Dad"]) {
      expect(SERIALISE, motif).not.toContain(motif);
    }
  });

  it("les personnes sans profil du tout partent aussi, et la source nommée", () => {
    const retires = new Map(CONTENU.retraits.map((r) => [r.id, r.motif]));
    expect(retires.get("kapadia23")).toBe("AUCUN_SUJET_GOUVERNE");
    expect(retires.get("TheFudHound")).toBe("AUCUN_SUJET_GOUVERNE");
    expect(retires.get("mariaqueennft")).toBe("AUCUN_SUJET_GOUVERNE");
    expect(SERIALISE).not.toContain("Parth Kapadia");
    expect(SERIALISE).not.toContain("Ryan Arriaga");
    expect(SERIALISE).not.toContain("mariaqueennft");
  });

  it("LE GRAPHE ET LA BASE NE NOMMENT PAS LA MÊME PERSONNE PAREIL", () => {
    // `@KokoskiB` côté graphe, `bkokoski` côté base. Une résolution qui
    // n'aurait essayé que `handle` aurait refusé le seul nœud parfaitement
    // fondé du corpus — un faux négatif sur du gouverné, exactement l'erreur
    // que la sensibilité à la casse produit sur /kol.
    const noeud = SERVI.nodes.find((n) => n.id === "bkokoski")!;
    expect(noeud.handle).toBe("@KokoskiB");
    expect(DECISIONS.has("kokoskib")).toBe(false);
    expect(DECISIONS.has("bkokoski")).toBe(true);
    expect(CONTENU.graphe.nodes.map((n) => n.id)).toContain("bkokoski");
  });

  it("aucun MONTANT par sujet ne survit — les proceeds sont une décision à part", () => {
    // `publishStatus='published'` ne fonde PAS un montant encaissé.
    // `KolProfile.proceedsPublication` le fait, et le graphe ne peut pas la
    // présenter. Le champ part même sur les nœuds fondés.
    for (const n of CONTENU.graphe.nodes) expect(n.totalScammedUsd, n.id).toBeUndefined();
    // Témoin : il était bien là, sur un nœud qui RESTE servi.
    expect(SERVI.nodes.find((n) => n.id === "bkokoski")!.totalScammedUsd).toBe(4500000);
  });

  it("MUTATION DISCRIMINANTE — les DEUX nœuds fondés restent", () => {
    // Une garde qui viderait tout serait désarmée. `bkokoski` et
    // `GordonGekko` portent un label IDENTIQUE à leur `displayName` publié.
    const ids = CONTENU.graphe.nodes.map((n) => n.id);
    expect(ids).toContain("bkokoski");
    expect(ids).toContain("GordonGekko");
    expect(SERIALISE).toContain("Brandon Kokoski");
  });

  it("AUCUNE note ne survit, sur AUCUN nœud — et c'est uniforme", () => {
    // Uniforme, donc invisible : une note présente ici et absente là dirait
    // laquelle portait quelque chose.
    for (const n of CONTENU.graphe.nodes) expect(n.notes, n.id).toBeUndefined();
    expect(SERIALISE).not.toContain('"notes"');
  });

  it("AUCUN label d'arête ne survit, et aucune arête ne pend", () => {
    const ids = new Set(CONTENU.graphe.nodes.map((n) => n.id));
    for (const e of CONTENU.graphe.edges) {
      expect(e.label, `${e.source}->${e.target}`).toBeUndefined();
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
    expect(SERIALISE).not.toContain("BOTIFY co-founders");
  });

  it("timeline et metrics disparaissent — `personCount` dirait combien ont été retirés", () => {
    expect(CONTENU.graphe.timeline).toBeUndefined();
    expect(CONTENU.graphe.metrics).toBeUndefined();
    expect(SERIALISE).not.toContain("totalScammedUsd_bkokoski");
    expect(SERIALISE).not.toContain("personCount");
    expect(SERIALISE).not.toContain("GHOST cashout");
  });

  it("`sourceOfTruth` est REMPLACÉ, pas retiré — le type l'exige", () => {
    // Même règle que l'Explorer : la clé est requise par le contrat de forme,
    // donc le refus est une chaîne identique et non une absence.
    expect(CONTENU.graphe.sourceOfTruth).toBe(SOURCE_NON_GOUVERNEE);
    expect(SERIALISE).not.toContain("INTERLIGENS prod DB");
  });

  it("██ BALAYAGE FINAL — aucun des motifs protégés ne survit dans la charge", () => {
    const interdits = [
      "Mom", "Dad", "Carter", "Illya", "Mum", "F&F", "family_fnf",
      "Insider supply", "Sam O'Leary", "Djordje", "Kapadia", "Arriaga",
      "mariaqueennft", "prod DB", "totalScammedUsd",
    ];
    for (const motif of interdits) expect(SERIALISE, motif).not.toContain(motif);
  });

  /**
   * ─── LA PROPRIÉTÉ N'EST PAS L'APPARTENANCE AU GROUPE ───────────────────
   *
   * Mon critère de containment trie les NŒUDS par `group` déclaré — 13 sur 41.
   * Mais la prose, elle, ne suit pas le groupe : **30 nœuds sur 41 portent des
   * `notes`**, répartis sur HUIT groupes. Les 17 qui portent du contenu sans
   * être du groupe protégé passeraient si la propriété était l'appartenance.
   *
   * Elle ne l'est pas. `NetworkNode.notes` n'a aucune fondation possible, donc
   * les notes tombent sur les 41 — uniformément, ce qui rend le retrait
   * invisible : une note présente ici et absente là dirait laquelle portait
   * quelque chose.
   */
  it("██ TÉMOIN — 30 nœuds sur 41 portent de la prose, sur HUIT groupes", () => {
    const avecNotes = SERVI.nodes.filter((n) => typeof n.notes === "string" && n.notes.length > 0);
    expect(avecNotes).toHaveLength(30);
    expect(new Set(avecNotes.map((n) => n.group)).size).toBe(8);
    // Et l'écrasante majorité N'EST PAS du groupe nominatif : 23 sur 30.
    // Les 6 nœuds `wallet_family` ne portent AUCUNE note — leur contenu
    // protégé est dans leur LABEL. Seuls 7 des 13 nominatifs ont de la prose.
    // Si la propriété était l'appartenance au groupe, 23 porteurs de prose
    // passeraient, et les 6 les plus lourds ne seraient même pas concernés.
    expect(avecNotes.filter((n) => !estNominatif(n))).toHaveLength(23);
    expect(avecNotes.filter((n) => estNominatif(n))).toHaveLength(7);
    expect(SERVI.nodes.filter((n) => n.group === "wallet_family" && n.notes)).toHaveLength(0);
  });

  it("██ LES FORMES QUE NI LE GROUPE NI UN GREP N'AURAIENT ATTRAPÉES", () => {
    const brut = JSON.stringify(SERVI);

    // ① UNE CORRECTION INTERNE, servie verbatim sur une personne nommée.
    //    C'est une note de rédaction d'enquête — « reframe from prior repo
    //    narrative » s'adresse à nous, pas au lecteur.
    expect(brut).toContain("NOT the serial operator — reframe from prior repo narrative.");

    // ② DU VOCABULAIRE DE STRATÉGIE JUDICIAIRE, deux fois — et sur des nœuds
    //    `infra_cex`, donc HORS du groupe nominatif. C'est la démonstration que
    //    le groupe ne suffit pas.
    expect((brut.match(/MLAT-subpoenable/g) ?? [])).toHaveLength(2);
    for (const id of ["cex_kucoin", "cex_gate"]) {
      const n = SERVI.nodes.find((x) => x.id === id)!;
      expect(estNominatif(n), `${id} n'est pas du groupe nominatif`).toBe(false);
      expect(n.notes).toContain("MLAT-subpoenable");
    }

    // ③ LA MÉTADONNÉE D'INGÉNIERIE, avec les cardinaux de la base de prod.
    expect(brut).toContain("INTERLIGENS prod DB (5 profiles, 29 evidences, 47 wallets");
    expect(brut).toContain("INVESTIGATION_DIONE_REPORT.md");

    // ── ET LES TROIS DISPARAISSENT ────────────────────────────────────────
    for (const forme of [
      "NOT the serial operator",
      "reframe from prior repo narrative",
      "MLAT-subpoenable",
      "INTERLIGENS prod DB",
      "INVESTIGATION_DIONE_REPORT.md",
    ]) {
      expect(SERIALISE, forme).not.toContain(forme);
    }
  });

  it("les motifs de retrait ne VOYAGENT PAS dans la charge", () => {
    // Ils partent au journal. Un motif dans la charge serait l'oracle livré
    // avec la garde.
    for (const motif of ["AUCUN_SUJET_GOUVERNE", "LABEL_NON_COUVERT", "SUJET_NON_PUBLIE", "EXTREMITE_RETIREE"]) {
      expect(SERIALISE).not.toContain(motif);
    }
    // Et ils existent bien, eux, pour le journal.
    expect(CONTENU.retraits.length).toBeGreaterThan(10);
  });

  /**
   * ─── LA PORTÉE TEMPORELLE — VÉRIFIÉE, PAS AJOUTÉE ──────────────────────
   *
   * Le critère ratifié :
   *
   *   « Temporal scope is part of the authority of a governed assertion
   *     whenever changing or omitting that scope can change the assertion's
   *     meaning. »
   *
   * L'âge seul ne suffit donc pas. Le défaut est : observation historique +
   * contexte temporel retiré → assertion qui a l'air courante. Sur une
   * assertion nominative, ce n'est plus la même assertion.
   *
   * ⚠ ET LE FAUX REMÈDE QU'ON N'A PAS APPLIQUÉ : ajouter mécaniquement un
   * `generatedAt` partout. `generatedAt` peut être la date de GÉNÉRATION DU
   * FICHIER et non l'`asOf` de l'OBSERVATION — la distinction déjà ratifiée
   * pour CaseFile. Il faut la date de l'ASSERTION, pas une date décorative.
   *
   * Ce que je fais ici : je VÉRIFIE ce que la charge porte naturellement.
   */
  it("la portée temporelle SURVIT au containment — elle n'est pas retirée avec sourceOfTruth", () => {
    // Le risque réel de ce lot : `sourceOfTruth` portait « on-chain reads
    // performed 2026-04-17 », et je le retire. Si c'était le seul porteur de
    // la portée, le containment aurait TRANSFORMÉ un instantané daté en
    // assertion sans date — donc aggravé le défaut qu'il prétend fermer.
    expect(SERVI.sourceOfTruth).toContain("on-chain reads performed 2026-04-17");
    expect(CONTENU.graphe.sourceOfTruth).not.toContain("2026-04-17");
    // Il reste, et il survit.
    expect(CONTENU.graphe.generatedAt).toBe("2026-04-17");
  });

  it("sur CETTE charge, `generatedAt` EST l'asOf — vérifié, pas supposé", () => {
    // Les deux dates coïncident, et la coïncidence est ADOSSÉE : la métadonnée
    // brute dit que les lectures on-chain ont eu lieu ce jour-là. Ce n'est donc
    // pas une date de build posée à côté d'observations plus anciennes.
    const dateDeLObservation = /on-chain reads performed (\d{4}-\d{2}-\d{2})/.exec(
      SERVI.sourceOfTruth,
    );
    expect(dateDeLObservation, "la métadonnée ne porte plus de date d'observation").not.toBeNull();
    expect(dateDeLObservation![1]).toBe(SERVI.generatedAt);
  });

  it("LA LACUNE RESTANTE EST DÉCLARÉE — aucune assertion ne porte SA propre portée", () => {
    // Ce qui reste servi porte des assertions nominatives sans date propre :
    // `risk: "confirmed_scammer"`, `rugCount: 12`. La portée n'existe qu'au
    // niveau du GRAPHE, à cinq mois de distance. Un lecteur voit une
    // qualification qui a l'air courante.
    //
    // Je ne l'invente pas : aucun champ de `NetworkNode` ne porte d'`asOf`, et
    // en fabriquer un à partir de `generatedAt` reviendrait à affirmer que
    // chaque observation date du jour du build — exactement le faux remède.
    // DÉCLARÉ, NON COMBLÉ.
    for (const n of CONTENU.graphe.nodes) {
      expect(n, `${n.id} porterait un asOf`).not.toHaveProperty("asOf");
      expect(n, `${n.id} porterait un observedAt`).not.toHaveProperty("observedAt");
    }
    const survivant = CONTENU.graphe.nodes.find((n) => n.id === "bkokoski");
    expect(survivant?.risk).toBe("confirmed_scammer");
    expect(survivant).not.toHaveProperty("asOf");
  });

  it("le critère porte sur le GROUPE DÉCLARÉ, pas sur le texte du label", () => {
    // Un nœud `token` dont le label contiendrait « Dad » n'est pas nominatif ;
    // un `wallet_family` au label anodin l'est. C'est la propriété déclarée par
    // la donnée qui décide, jamais son orthographe.
    expect(estNominatif({ group: "token" })).toBe(false);
    expect(estNominatif({ group: "wallet_family" })).toBe(true);
    expect(estNominatif({ group: "person" })).toBe(true);
    expect(GROUPES_NOMINATIFS).toContain("source");
  });

  it("██ MUTANT DE BYPASS BRUT — une décision qui ne couvre pas le label ne passe pas", () => {
    // Le mutant : on « présente une décision » pour sxyz500, mais son
    // displayName publié reste « Sxyz500 ». Le nœud ne revient pas.
    const mutant = new Map(DECISIONS);
    mutant.set("sxyz500", { handle: "sxyz500", publishStatus: "published", displayName: "Sxyz500" });
    const r = contenirGraphe(SERVI, mutant);
    expect(r.graphe.nodes.map((n) => n.id)).not.toContain("sxyz500");

    // SUR-CORRECTION — et si le displayName publié devenait le label du
    // graphe, le nœud reviendrait. La garde mesure bien la couverture, pas
    // l'identité du sujet.
    const couvrant = new Map(DECISIONS);
    couvrant.set("sxyz500", { handle: "sxyz500", publishStatus: "published", displayName: "Sam O'Leary (SAMBO)" });
    const r2 = contenirGraphe(SERVI, couvrant);
    expect(r2.graphe.nodes.map((n) => n.id)).toContain("sxyz500");
  });

  it("un sujet connu mais NON PUBLIÉ est refusé pour cette raison-là", () => {
    const mutant = new Map(DECISIONS);
    mutant.set("bkokoski", { handle: "bkokoski", publishStatus: "draft", displayName: "Brandon Kokoski" });
    const r = contenirGraphe(SERVI, mutant);
    const retires = new Map(r.retraits.map((x) => [x.id, x.motif]));
    expect(retires.get("bkokoski")).toBe("SUJET_NON_PUBLIE");
    expect(JSON.stringify(r.graphe)).not.toContain("Brandon Kokoski");
  });
});
