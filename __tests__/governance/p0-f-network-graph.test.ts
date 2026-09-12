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

  it("les motifs de retrait ne VOYAGENT PAS dans la charge", () => {
    // Ils partent au journal. Un motif dans la charge serait l'oracle livré
    // avec la garde.
    for (const motif of ["AUCUN_SUJET_GOUVERNE", "LABEL_NON_COUVERT", "SUJET_NON_PUBLIE", "EXTREMITE_RETIREE"]) {
      expect(SERIALISE).not.toContain(motif);
    }
    // Et ils existent bien, eux, pour le journal.
    expect(CONTENU.retraits.length).toBeGreaterThan(10);
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
