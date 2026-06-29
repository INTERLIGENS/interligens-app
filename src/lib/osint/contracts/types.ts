/**
 * src/lib/osint/contracts/types.ts
 *
 * SPRINT A0 — Contrats de données du pipeline retail OSINT (vision ingest).
 *
 * Ces interfaces décrivent CE QUI CIRCULE entre les étages (extraction →
 * décision → commit shadow → revue). AUCUNE logique, AUCUN appel : juste les
 * formes. La taxonomie de statut associée vit dans ./status.ts.
 *
 * Réutilisation : `Confidence` et `VisionChain` sont déjà la source de vérité
 * dans ../vision/visionPrompt.ts (utilisés par callVision/resolveTokens/buildPlan).
 * On les IMPORTE et RE-EXPORTE ici pour ne pas créer un second type divergent.
 */

import type { Confidence, VisionChain } from "../vision/visionPrompt";
import type {
  ClaimStatus,
  ExtractionDecision,
  PendingReason,
  RejectReason,
  SourceTrustTier,
} from "./status";

export type { Confidence, VisionChain };

/**
 * Décision attachée à UN claim (ExtractedClaim) à l'issue de l'extraction +
 * des locks. `decision` est le verdict figé (./status ExtractionDecision),
 * `reason` un texte d'audit court. `pendingReason` n'est posé que si
 * decision === 'PENDING' ; `rejectReason` que si decision === 'REJECT'.
 *
 *  AUTO_COMMIT_EVIDENCE   on commit la capture comme preuve (EvidenceSnapshot)
 *                         SANS lien public — source datée, rien d'attribué.
 *  AUTO_COMMIT_ASSERTION  on commit preuve + KolTokenLink en shadow (visibility
 *                         'draft', jamais public) — assertion KOL↔token.
 *  PENDING                rien de commité, part en revue humaine (PendingReason).
 *  REJECT                 rien de commité, soumission écartée (RejectReason).
 */
export interface ExtractionDecisionRecord {
  decision: ExtractionDecision;
  reason: string;
  pendingReason?: PendingReason;
  rejectReason?: RejectReason;
}

/**
 * ExtractedClaim — UNE assertion atomique extraite d'une capture : « ce KOL a
 * promu ce token (ce CA, sur cette chain), perf X ». Une capture produit
 * ExtractedClaim[] (1 par cashtag distinct, cf. règle multi-ticker vision).
 *
 * Chaque champ factuel porte SA propre confiance (`*Confidence`). Important :
 * `contractAddressCertain` est l'auto-déclaration du modèle — elle n'est JAMAIS
 * une autorité de résolution (cf. commit 3-lock CA resolution) ; on la garde
 * uniquement comme hint loggé.
 */
export interface ExtractedClaim {
  tokenSymbol: string | null;            // cashtag sans le '$', ou null si illisible
  tokenSymbolConfidence: Confidence;

  contractAddress: string | null;        // EXACT seulement si 100% lisible, sinon null
  contractAddressConfidence: Confidence;
  contractAddressCertain: boolean;       // hint modèle, JAMAIS autorité (voir 3-lock)

  chain: VisionChain;                    // 'solana' | 'ethereum' | 'unknown'
  chainConfidence: Confidence;

  perf: string | null;                   // "12x", "called at $400K" — seulement si visible

  kolHandle: string | null;              // sans '@', ou null si non lisible
  kolHandleConfidence: Confidence;

  /** Verdict + raison figés pour CE claim. */
  decision: ExtractionDecisionRecord;
  /** Niveau de vérification atteint par CE claim. */
  claimStatus: ClaimStatus;
}

/**
 * ProvenanceRecord — la traçabilité forensique d'UNE soumission : d'où vient
 * l'image, comment elle a été lue, par qui elle a été envoyée. C'est ce qui
 * rend une ingestion auditable et non répudiable. Persiste sur OsintSubmission
 * (table additive non encore appliquée — voir MIGRATION_osint_submission_v1.sql).
 */
export interface ProvenanceRecord {
  imageSha256: string;                   // hash exact du fichier (dédup forte + clé EvidenceSnapshot.sha256)
  perceptualHash: string | null;         // pHash pour near-dup ; null si non calculé
  promptVersion: string;                 // ex "vision_v1" — version du système de prompt
  modelVersion: string;                  // ex "claude-sonnet-4-5" (VISION_MODEL)
  rawVisionPass1: unknown;               // JSON brut de la passe 1 (audit, non typé ici)
  rawVisionPass2: unknown | null;        // JSON brut de la passe 2 ; null si lecture simple
  decisionReasons: string[];             // trace lisible des décisions (warnings + raisons)
  ingestedAt: string;                    // ISO 8601 UTC (instant d'ingestion serveur)
  sourceType: string;                    // ex "osint_screenshot"
  trustTier: SourceTrustTier;            // confiance accordée au soumetteur
  submitter: string;                     // IP-hash (anonyme) ou userId
}

/**
 * Métadonnées de capture (le fichier lui-même, indépendamment du contenu lu).
 * `capturedAt` peut être null à l'ingestion : il est dérivé du mtime/nom de
 * fichier en Asia/Makassar (UTC+8), JAMAIS inféré du contenu du tweet
 * (cf. feedback_osint_capture_timezone).
 */
export interface CaptureMeta {
  fileName: string;
  bytes: number;
  width: number | null;
  height: number | null;
  capturedAt: string | null;             // ISO 8601 UTC, ou null si inconnu à l'ingestion
  timezoneAssumption: string;            // "Asia/Makassar (UTC+08:00)"
  sessionId: string | null;
}

/**
 * ExtractionPlan — la sortie complète d'une ingestion : la provenance, les
 * claims atomiques, et les métadonnées de capture. C'est l'objet pivot que la
 * couche décision/commit consomme. UNE capture → UN ExtractionPlan.
 */
export interface ExtractionPlan {
  provenance: ProvenanceRecord;
  claims: ExtractedClaim[];
  captureMeta: CaptureMeta;
}
