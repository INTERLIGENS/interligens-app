// --- Scoring v2 (pur) -----------------------------------------------------
//
// Trois differences de fond avec le scorer v1 :
//   1. l'unite est l'OCCASION (correctif #1) ;
//   2. le ratio ne credite la recurrence qu'au-dessus d'un plancher de n
//      (correctif #2), valeur CONFIGURABLE et EN ATTENTE DE RATIFICATION ;
//   3. le LIFT (M1/M2) entre dans la composition - et son ABSENCE aussi,
//      explicitement, jamais comme un zero.
//
// INVARIANT SHILL-M2 (2026-09-03) : absence de mesure != preuve a charge. Un
// lift non mesure ne bonifie ni ne penalise ; la classification comportementale
// est conservee. Un lift MESURE et faible, lui, reste opposable.
//
// Le score ne conclut rien. `limitations` porte ce qu'il n'a PAS pu etablir.

import { compareToThreshold, isMeasured } from "../measurement";
import type {
  CandidateScores,
  Classification,
  Confidence,
  CorrelationFeatures,
} from "./types";
import type { EnginePolicy } from "./policy";

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreFeatures(f: CorrelationFeatures, policy: EnginePolicy): CandidateScores {
  const limitations: string[] = [];

  // --- Correctif #2 : le plancher de n ------------------------------------
  const ratioCredited = f.observedOccasions >= policy.minOccasionsForRatio;
  if (!ratioCredited) {
    limitations.push(
      `ratio non credite : ${f.observedOccasions} occasion(s) observee(s) < plancher ` +
        `${policy.minOccasionsForRatio} - un ratio sur si peu d'occasions n'etablit pas une recurrence`,
    );
  }

  const countComponent = Math.min(1, f.observedOccasions / policy.recurrenceCountCap);
  const recurrenceScore = clamp100(
    ratioCredited
      ? 100 * (0.5 * f.ratioObserved + 0.5 * countComponent)
      : 100 * (0.5 * countComponent),
  );

  const specificityScore = clamp100(100 / Math.max(1, f.distinctKolCount));

  const zoned = f.preTweetCount + f.nearTweetCount + f.postTweetCount;
  const w = policy.timingWeights;
  const timingScore =
    zoned > 0
      ? clamp100(
          (100 *
            (f.preTweetCount * w.pre + f.nearTweetCount * w.near + f.postTweetCount * w.post)) /
            zoned,
        )
      : 0;

  // --- B : sans temoin, le lift ne vaut pas zero, il vaut INCONNU ---------
  //
  // Un lift absent ne doit pas etre lu comme « pas de correlation » : il doit
  // etre lu comme « on ne sait pas ». Sa contribution est retiree ET son poids
  // redistribue - sinon un candidat sans temoin serait penalise comme un
  // candidat dont le temoin infirme la correlation. La redistribution n'est
  // PAS silencieuse : elle porte un drapeau (`compositeRenormalized`), une
  // limitation nommee, et un motif enumere en telemetrie.
  const liftMeasured = isMeasured(f.lift) && !f.lift.censored;
  let liftScore = 0;
  let composite = policy.composite;
  let compositeRenormalized = false;

  if (liftMeasured) {
    liftScore = clamp100(100 * Math.min(1, f.lift.value / (policy.minLift * 2)));
  } else {
    limitations.push(
      `lift NON MESURE (${f.liftUnmeasurableReason ?? "motif absent"}) - la co-occurrence ` +
        "n'est rapportee a aucun taux de base (M1). Le poids du lift est redistribue " +
        "sur les composantes mesurees ; le score qui en sort decrit moins de choses.",
    );
    const c = policy.composite;
    const redistribute = c.lift / (c.recurrence + c.timing + c.specificity);
    composite = {
      recurrence: c.recurrence * (1 + redistribute),
      timing: c.timing * (1 + redistribute),
      specificity: c.specificity * (1 + redistribute),
      lift: 0,
    };
    compositeRenormalized = true;
  }

  if (f.absentFromMeasuredBaseline) {
    // FAIT rapporte, sans effet sur le score. Voir policy.FORBIDDEN_POLICY_KEYS.
    limitations.push(
      "absent d'un temoin MESURE et suffisant : ce wallet n'apparait dans aucune fenetre " +
        "temoin. C'est la piste la plus interessante du dispositif, et elle reste une " +
        "PISTE - lui attribuer un lift de substitution serait inventer le nombre qui manque.",
    );
  }

  const genericSniperPenalty = clamp100((f.distinctKolCount - 1) ** 2 * policy.sniperPerExtraKol);

  const base =
    composite.recurrence * recurrenceScore +
    composite.timing * timingScore +
    composite.specificity * specificityScore +
    composite.lift * liftScore;
  const correlationScore = clamp100(base - genericSniperPenalty);

  const shortlistEligible =
    ratioCredited &&
    f.observedOccasions >= policy.shortlist.minOccasions &&
    f.preTweetCount >= policy.shortlist.minPreTweet &&
    f.ratioObserved >= policy.shortlist.minRatio;

  const seriousCandidate =
    f.observedOccasions >= policy.serious.minOccasions &&
    specificityScore >= policy.serious.minSpecificity;

  let confidence: Confidence = "low";
  let classification: Classification = "watch";
  if (seriousCandidate && correlationScore >= policy.confidence.highScore) {
    confidence = "high";
    classification = "high_interest";
  } else if (shortlistEligible && correlationScore >= policy.confidence.mediumScore) {
    confidence = "medium";
    classification = "candidate";
  }

  // --- M2 OPPOSABLE : le verdict de seuil, dans la grammaire de SHILL-C1 ---
  //
  // `compareToThreshold` rend trois issues, jamais deux. On les traite toutes
  // les trois explicitement - c'est la difference entre mesurer un taux de base
  // et le journaliser sans jamais l'opposer.
  const liftVerdict = compareToThreshold(f.lift, policy.minLift);

  if (policy.liftGatesClassification && liftVerdict === "below" && classification !== "watch") {
    limitations.push(
      `lift mesure a ${f.lift.value} < ${policy.minLift} - ramene a 'watch' : ce wallet ` +
        "n'achete pas plus autour des publications qu'en dehors, la co-occurrence ne se " +
        "distingue pas du bruit de fond",
    );
    classification = "watch";
    confidence = "low";
  }

  // ═══ INVARIANT SHILL-M2 — ABSENCE DE MESURE != PREUVE A CHARGE ═══════════
  //
  //   Une mesure qu'on n'a PAS PU FAIRE ne dit rien sur ce qu'elle aurait
  //   montre. La traiter comme defavorable, c'est faire dire quelque chose a
  //   un silence - et toujours la meme chose.
  //
  // CE QUI A RENDU L'INVARIANT NECESSAIRE, mesure le 2026-09-03 : 78 % du
  // corpus (149/192 evenements) porte des tokens pump.fun nes juste avant le
  // shill. Leur fenetre temoin precede leur premiere transaction : ils sont
  // STRUCTURELLEMENT non mesurables. Plafonner sur cette absence ne mesurait
  // aucune correlation faible - cela penalisait la nature du corpus, et
  // uniformement.
  //
  // CE QUE M2 N'AUTORISE PAS, et c'est la moitie qui compte : un lift MESURE
  // et faible reste opposable (bloc `liftGatesClassification` ci-dessus).
  // M2 protege l'ABSENCE de mesure, jamais une mesure defavorable.
  //
  // Le poids du lift non mesure est deja retire ET redistribue plus haut
  // (`compositeRenormalized`) : le score ne le penalise pas non plus. Un
  // liftScore a 0 laisse dans une moyenne ponderee AURAIT ete une penalite
  // silencieuse - c'est la meme faute, une couche plus bas.
  //
  // Le drapeau reste dans la policy, ratifie a `false` le 2026-09-03 (reverse
  // date du 2026-08-30). Il n'est pas supprime : une bascule silencieuse en
  // arriere doit rester lisible comme une DECISION, pas comme un defaut.
  if (policy.unmeasuredLiftCapsClassification && liftVerdict === "indeterminate" && classification !== "watch") {
    limitations.push(
      `classification ramenee a 'watch' : le lift n'est pas mesure ` +
        `(${f.liftUnmeasurableReason ?? "motif absent"}). Une correlation « superieure au ` +
        "bruit de fond » ne peut pas etre affirmee sans bruit de fond mesure (SHILL-C1).",
    );
    classification = "watch";
    confidence = "low";
  } else if (liftVerdict === "indeterminate") {
    // SHILL-M2. La limitation est CONSERVEE - le lecteur doit savoir que le
    // score decrit moins de choses - mais elle ne devient pas une sanction.
    // Le motif n'est PAS lu ici : au scoring, TOKEN_TOO_YOUNG et
    // BASELINE_CENSORED disent la meme chose, « on ne sait pas ». Ils restent
    // distincts en observabilite, ou la distinction sert a agir.
    limitations.push(
      `lift NON MESURE (${f.liftUnmeasurableReason ?? "motif absent"}) : la classification ` +
        "comportementale est CONSERVEE (SHILL-M2 - une mesure absente n'est pas une preuve " +
        "a charge). Le score repose sur les seules dimensions mesurees.",
    );
  }

  return {
    recurrenceScore: round2(recurrenceScore),
    specificityScore: round2(specificityScore),
    timingScore: round2(timingScore),
    liftScore: round2(liftScore),
    liftCounted: liftMeasured,
    compositeRenormalized,
    genericSniperPenalty: round2(genericSniperPenalty),
    correlationScore: round2(correlationScore),
    shortlistEligible,
    seriousCandidate,
    confidence,
    classification,
    ratioCredited,
    limitations,
  };
}
