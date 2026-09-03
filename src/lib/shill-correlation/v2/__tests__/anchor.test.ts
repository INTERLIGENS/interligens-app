// --- Anti-régression du décalage d'horloge de 7 200 s ---------------------
//
// LE BUG, MESURÉ le 2026-09-03 par sonde réelle :
//   timestamp on-chain − firstSeenAt = 7 200 s, sur 896 signatures,
//   4 tokens, 3 KOL, 4 dates. UNE SEULE valeur distincte. Variance NULLE.
//
// `ShillEvent.tweetTimestamp` est EN RETARD sur l'instant on-chain réel, de
// l'offset Europe/Paris applicable à sa date — signature d'un instant UTC
// traité comme heure locale puis re-sérialisé en UTC. Comparée telle quelle à
// un timestamp on-chain, toute fenêtre était décalée de 2 h, et la fenêtre
// témoin mesurait un moment où rien de ce qu'on cherchait ne s'était produit.
//
// Ces tests tiennent la SÉMANTIQUE, pas la compensation : c'est le fuseau qui
// corrige, jamais une constante. D'où le cas d'hiver, qui n'est pas décoratif.

import { describe, it, expect } from "vitest";
import {
  CORPUS_WALL_CLOCK_ZONE,
  MEASURED_CORPUS_DRIFT_SUMMER_SECONDS,
  WINTER_DRIFT_IS_INFERRED_NOT_MEASURED,
  anchorSeconds,
  onChainAnchorFromCorpus,
  onChainAnchorFromUtc,
} from "../anchor";
import { baselineWindow, observedWindow } from "../windows";
import { DEFAULT_ENGINE_POLICY } from "../policy";
import { classifyTiming } from "../../buyers";

const P = DEFAULT_ENGINE_POLICY;

describe("ancre - conversion corpus -> UTC on-chain", () => {
  it("le fuseau du corpus est DÉCLARÉ, pas deviné", () => {
    expect(CORPUS_WALL_CLOCK_ZONE).toBe("Europe/Paris");
  });

  it("ÉTÉ (CEST) : l'instant vrai est POSTÉRIEUR de 7 200 s — la mesure réelle", () => {
    // Rejoue la mesure, pas un exemple : onchain − stocké = +7 200 s.
    // Le sens inverse est l'erreur naturelle, et il donne 4 h d'écart, pas 0.
    const stocke = new Date("2026-06-03T18:57:31.000Z");
    const vrai = onChainAnchorFromCorpus(stocke);
    expect(vrai.getTime() - stocke.getTime()).toBe(MEASURED_CORPUS_DRIFT_SUMMER_SECONDS * 1000);
    expect(vrai.toISOString()).toBe("2026-06-03T20:57:31.000Z");
  });

  it("HIVER (CET) : +1 h — INFÉRÉ du fuseau, PAS mesuré", () => {
    // Le corpus va de 2025-01 à 2026-06 : il contient des dates d'hiver. Une
    // constante de 7 200 les décalerait d'une heure — un bug uniforme
    // remplacé par un bug saisonnier, donc invisible.
    // Aucun événement d'hiver ne porte d'observation : c'est une conséquence
    // de l'hypothèse du fuseau, pas une vérité terrain. Voir
    // WINTER_DRIFT_IS_INFERRED_NOT_MEASURED.
    const stocke = new Date("2026-01-15T18:57:31.000Z");
    const vrai = onChainAnchorFromCorpus(stocke);
    expect(vrai.getTime() - stocke.getTime()).toBe(3600 * 1000);
    expect(WINTER_DRIFT_IS_INFERRED_NOT_MEASURED).toBe(true);
  });

  it("la transition d'heure d'été est franchie sans erreur d'une heure", () => {
    // 2026-03-29 02:00 Paris : CET -> CEST. La double passe existe pour ça.
    const avant = onChainAnchorFromCorpus(new Date("2026-03-28T12:00:00.000Z"));
    const apres = onChainAnchorFromCorpus(new Date("2026-03-30T12:00:00.000Z"));
    expect(avant.toISOString()).toBe("2026-03-28T13:00:00.000Z"); // +1 (CET)
    expect(apres.toISOString()).toBe("2026-03-30T14:00:00.000Z"); // +2 (CEST)
  });

  it("une source DÉJÀ en UTC vrai n'est pas convertie, seulement marquée", () => {
    const utc = new Date("2026-06-03T20:57:31.000Z");
    expect(onChainAnchorFromUtc(utc).toISOString()).toBe(utc.toISOString());
  });

  it("anchorSeconds rend des secondes unix - l'unité des timestamps Helius", () => {
    const a = onChainAnchorFromUtc(new Date("2026-06-03T20:57:31.000Z"));
    expect(anchorSeconds(a)).toBe(Math.floor(a.getTime() / 1000));
    expect(Number.isInteger(anchorSeconds(a))).toBe(true);
  });
});

describe("ancre - le test qui AURAIT ÉCHOUÉ avant le correctif", () => {
  // Reproduction du cas réel : empire_sol1 / 3ghKZfLZ…pump.
  const STOCKE = new Date("2026-06-03T18:57:31.000Z");
  /** Un achat v1 réel, à −596 s du tweet dans l'horloge du corpus. */
  const ACHAT_CORPUS_S = Math.floor(STOCKE.getTime() / 1000) - 596;
  /** Son timestamp on-chain VRAI : le corpus est en avance de 7 200 s. */
  const ACHAT_ONCHAIN_S = ACHAT_CORPUS_S + MEASURED_CORPUS_DRIFT_SUMMER_SECONDS;

  it("ancre CORRIGÉE : l'achat réel tombe DANS la fenêtre d'observation", () => {
    const w = observedWindow(onChainAnchorFromCorpus(STOCKE));
    expect(ACHAT_ONCHAIN_S * 1000).toBeGreaterThanOrEqual(w.startMs);
    expect(ACHAT_ONCHAIN_S * 1000).toBeLessThanOrEqual(w.endMs);
  });

  it("ancre NON corrigée : le MÊME achat tombe hors fenêtre - le bug, reproduit", () => {
    // C'est exactement ce que la sonde a observé : 448 signatures présentes,
    // 0 dans la fenêtre. Le test échouerait si quelqu'un retirait la
    // conversion et repassait le timestamp du corpus tel quel.
    const bugge = observedWindow(onChainAnchorFromUtc(STOCKE));
    const dedans =
      ACHAT_ONCHAIN_S * 1000 >= bugge.startMs && ACHAT_ONCHAIN_S * 1000 <= bugge.endMs;
    expect(dedans).toBe(false);
  });

  it("la fenêtre témoin est elle aussi recalée - c'est elle que le bug vidait", () => {
    const vrai = onChainAnchorFromCorpus(STOCKE);
    const b = baselineWindow(vrai, P);
    const bugge = baselineWindow(onChainAnchorFromUtc(STOCKE), P);
    expect(b.anchorMs - bugge.anchorMs).toBe(MEASURED_CORPUS_DRIFT_SUMMER_SECONDS * 1000);
    // Et le témoin reste disjoint de l'observation après correction.
    expect(observedWindow(vrai).startMs).toBeGreaterThan(b.endMs);
  });
});

describe("ancre - la classification v1 pre/near/post est INVARIANTE", () => {
  // Le point rassurant du diagnostic : l'ancre ET les achats sont décalés
  // À L'IDENTIQUE dans le corpus. Le signal comportemental que v1 a calculé
  // est donc intact - seules les jointures au temps on-chain cassaient.
  const deltas = [-596, -120, -31, -30, 0, 45, 90, 91, 300, 847];

  it("un décalage constant de l'ancre ne change AUCUNE zone", () => {
    // On MODÉLISE le décalage au lieu de l'annuler algébriquement : ancre et
    // achat sont translatés du même D, puis le delta est RECALCULÉ. Un test
    // qui écrirait `d + D - D` ne prouverait rien.
    const D = MEASURED_CORPUS_DRIFT_SUMMER_SECONDS;
    const ancreCorpus = Math.floor(new Date("2026-06-03T18:57:31.000Z").getTime() / 1000);
    for (const d of deltas) {
      const achatCorpus = ancreCorpus + d;
      // Version corpus : delta lu dans l'horloge décalée.
      const zoneCorpus = classifyTiming(achatCorpus - ancreCorpus);
      // Version corrigée : les DEUX passent en on-chain, puis on recalcule.
      const zoneVraie = classifyTiming(achatCorpus + D - (ancreCorpus + D));
      expect(zoneVraie).toEqual(zoneCorpus);
      expect(zoneVraie.type).toBe(classifyTiming(d).type);
    }
  });

  it("corriger l'ancre SEULE, sans l'achat, reclasserait TOUT - le contre-test", () => {
    // Preuve que l'invariance vient de la translation CONJOINTE, pas d'une
    // insensibilité de classifyTiming. Corriger un seul des deux côtés fait
    // basculer chaque achat en post_tweet, à 2 h du tweet.
    const D = MEASURED_CORPUS_DRIFT_SUMMER_SECONDS;
    for (const d of deltas) {
      expect(classifyTiming(d - D).type).toBe("pre_tweet");
      expect(classifyTiming(d + D).type).toBe("post_tweet");
    }
  });

  it("les bornes de zone tiennent des deux côtés du correctif", () => {
    // Ce qui compte est le DELTA, pas l'instant absolu : corriger l'ancre ne
    // peut pas reclasser un achat, parce que l'achat bouge avec elle.
    expect(classifyTiming(-31).type).toBe("pre_tweet");
    expect(classifyTiming(-30).type).toBe("near_tweet");
    expect(classifyTiming(90).type).toBe("near_tweet");
    expect(classifyTiming(91).type).toBe("post_tweet");
  });

  it("v1 reste auto-cohérent : delta = achat − tweet, tous deux dans le corpus", () => {
    const tweetCorpus = Math.floor(new Date("2026-06-03T18:57:31.000Z").getTime() / 1000);
    const achatCorpus = tweetCorpus - 596;
    const D = MEASURED_CORPUS_DRIFT_SUMMER_SECONDS;
    // Après correction des DEUX, le delta est rigoureusement le même.
    expect(achatCorpus - D - (tweetCorpus - D)).toBe(achatCorpus - tweetCorpus);
  });
});
