// ─── Index des dossiers d'enquête — sémantique déclarée ────────────────────
//
// SEUL fichier de la V3 autorisé à lire CA_MAP (src/lib/kol/proceeds.ts,
// chemin gelé — importé, jamais réécrit).
//
// ─── Ce que CA_MAP est, et ce qu'elle n'est pas ──────────────────────────
// CA_MAP est un index **identifiant de dossier → contrat**. Son producteur le
// dit sans ambiguïté (proceeds.ts) :
//
//     const caseIds = profile.kolCases.map((c) => c.caseId);
//     caseIds.map((id) => ({ caseId: id, ca: CA_MAP[id] }))
//
// Ses clés RESSEMBLENT à des tickers, et c'est précisément le piège :
//
//     CA_MAP["SERIAL-12RUGS"] = BYZ9CcZ…   ← le contrat de BOTIFY
//     CA_MAP["DIONE-RUG"]     = De4ULou…   ← le contrat du dossier GHOST
//     CA_MAP["GHOST-RUG"]     = De4ULou…   ← même contrat, autre clé
//
// « SERIAL-12RUGS » est un identifiant de dossier — « douze rugs en série », un
// motif de comportement. Ce n'est le ticker d'aucun token. Trois clés pointent
// deux contrats : la structure n'est pas une bijection ticker↔contrat et n'a
// jamais prétendu l'être.
//
// La V3 la consommait comme un mapping ticker → contrat. Résultat mesuré :
// `$SERIAL-12RUGS` résolvait vers le contrat de BOTIFY en HIGH, et le contrat
// De4ULou… — absent de toute ligne KolTokenLink — fabriquait un rival fantôme
// sous le symbole $GHOST qui bloquait la résolution du vrai lien curé.
//
// ─── UR-12, invariant contractuel ────────────────────────────────────────
// Une structure indexée par caseId ne peut jamais être consommée comme un
// mapping ticker/symbole SANS TRANSFORMATION EXPLICITE.
//
// Or aucune transformation caseId → ticker n'existe : KolCase ne porte que
// (kolHandle, caseId, role, …), pas de colonne symbole. Vérifié en lecture
// seule sur ep-square-band le 2026-08-27 — caseId distincts en base :
// BOTIFY · GHOST · RAVE-DUMP-APR2026 · SERIAL-12RUGS.
//
// Conséquence tenue ici : cet index n'est accessible QUE par identifiant de
// dossier. Le type CaseId est nominal — on ne peut pas y passer une chaîne
// quelconque sans appeler asCaseId(), qui est le point où l'intention devient
// explicite et relisible en revue. Le compilateur porte l'invariant ; le test
// statique UR-12 le porte aussi, pour le jour où quelqu'un ajoutera un `as any`.

import { CA_MAP } from "@/lib/kol/proceeds";
import { normalizeAddress } from "../address";
import { inferAddressShape } from "../address";
import type { RawCandidate } from "../types";

declare const CASE_ID_BRAND: unique symbol;

/**
 * Identifiant de dossier d'enquête. Type nominal : une chaîne quelconque n'est
 * PAS un CaseId tant qu'elle n'est pas passée par asCaseId().
 */
export type CaseId = string & { readonly [CASE_ID_BRAND]: true };

/**
 * Déclare explicitement qu'une chaîne est un identifiant de dossier.
 * À n'appeler QUE sur une valeur qui vient réellement d'un champ caseId
 * (KolCase.caseId, KolTokenLink.caseId, saisie admin d'un dossier). Ne jamais
 * l'appeler sur un cashtag lu dans un post : c'est exactement la confusion que
 * UR-12 interdit.
 */
export function asCaseId(raw: string): CaseId {
  return raw.trim().toUpperCase() as CaseId;
}

/** Identifiants de dossier connus de l'index. Utile en diagnostic et en revue. */
export function knownCaseIds(): CaseId[] {
  return Object.keys(CA_MAP).map((k) => k as CaseId);
}

/** Contrat associé à un dossier, ou null. Accessible uniquement par CaseId. */
export function contractForCaseId(caseId: CaseId): string | null {
  return CA_MAP[caseId] ?? null;
}

/**
 * Candidats issus d'identifiants de dossier fournis par l'appelant.
 *
 * Aucun symbole n'est posé sur ces candidats : l'index ne porte pas de ticker,
 * et en inventer un rendrait le candidat comparable à une requête par symbole —
 * ce qui recréerait le défaut. Le candidat vaut par son CONTRAT, comme le veut
 * E5 ; c'est aux autres sources de lui attacher un symbole si elles en ont un.
 */
export function findContractsByCaseIds(caseIds: readonly CaseId[]): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  for (const caseId of caseIds) {
    const contract = contractForCaseId(caseId);
    if (!contract) continue;
    const shape = inferAddressShape(contract);
    if (!shape.inferredChain) continue;
    const norm = normalizeAddress(contract, shape.inferredChain);
    if (!norm.valid || !norm.address) continue;
    const key = `${shape.inferredChain}:${norm.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      chain: shape.inferredChain,
      address: norm.address,
      symbol: null,
      source: "ca_map",
      chainInferred: true,
      signals: { isPumpFun: norm.isPumpFun },
    });
  }
  return out;
}
