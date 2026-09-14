# T1-CAUSE-ET-REVOKE-REEL — journal d'exécution, 2026-09-14

Fenêtre exécutée sur la branche `feat/cc-offline-186-cause-et-revoke`, code committé **72cc4dd** au moment de l'écriture (arbre propre, vérifié avant `--executer`).

## Étape 1 — introspection réelle (PG 17.11, ep-square-band)

`npx tsx scripts/casefile/verifier-decisions-publication-schema.ts` → **exit 0**.
Colonne `cause` : text, nullable, sans défaut. Contraintes lues par `pg_get_constraintdef` :

- `casefile_claim_publication_decisions_cause_vocabulaire` : `CHECK ((cause = 'INSUFFICIENT_SOURCE_PROVENANCE'::text))`
- `casefile_claim_publication_decisions_cause_coherence` : `CHECK ((((decision = 'GRANT'::text) AND (cause IS NULL)) OR ((decision = 'REVOKE'::text) AND (cause IS NOT NULL))))`

Triggers `_no_rewrite` et `_no_truncate` présents, `tgenabled = 'O'`. Lignes 16/17/18 : GRANT, cause NULL, decided_by David Douville.

## Étape 2 — CHECK violés exprès, transaction annulée

`npx tsx scripts/casefile/prouver-contraintes-cause-pg17-rollback.mts` → 0 KO.

| Essai | Résultat | Contrainte |
|---|---|---|
| a) INSERT GRANT + cause | 23514 | `_cause_coherence` |
| b) INSERT REVOKE, cause NULL | 23514 | `_cause_coherence` |
| c) INSERT REVOKE, cause hors vocabulaire | 23514 | `_cause_vocabulaire` |
| d) INSERT REVOKE, INSUFFICIENT_SOURCE_PROVENANCE | PASSE (annulé) | — |
| e) cause en minuscules | 23514 | `_cause_vocabulaire` |

Après ROLLBACK : 3 lignes 16/17/18. Séquence 26 → 31.

## Étape 3 — UNKNOWN non fondable

`FOUNDATION_TOLERATED_PROVENANCE = ["OPERATOR_DECLARED", "EXTRACTED", "VERIFIED"]`. UNKNOWN (explicite ou absent) → `SOURCE_PROVENANCE_UNQUALIFIED`, au fondement comme à la publication. Vocabulaire des sept causes inchangé. Mutant M11 (UNKNOWN re-toléré) : 6 tests rouges. Suite 499 fichiers / 7150 tests, typecheck, lint 0 erreur, ratchet stable.

## Étape 4 — cause câblée, répétition à blanc

`executeRevoke` écrit `cause` ($7) et la relit ; `decideRevoke` exige l'égalité (DECISION_NOT_REVOKE @ decision.cause). Mutants M12 (cause non comparée) et M13 (cause non écrite) rouges. Répétition en prod annulée : 0 KO, cause persistée et relue, séquence 31 → 36.

## Étape 5 — les trois REVOKE réels

```
EXÉCUTION RÉELLE · PostgreSQL 17.11 (df1f1a3) on aarch64-unknown-linux-gnu
AVANT   {"claims":{"n":22,"md5":"f9e2828425273b524f404865f2ee00d0"},"sources":{"n":10,"md5":"982d486221dffc48ee262852493809b7"},"decisions":["16:GRANT:∅","17:GRANT:∅","18:GRANT:∅"],"publishStatus":"draft"}
APRÈS   {"claims":{"n":22,"md5":"a245b69ba90a1389f79cd0cbcdea725c"},"sources":{"n":10,"md5":"982d486221dffc48ee262852493809b7"},"decisions":["16:GRANT:∅","17:GRANT:∅","18:GRANT:∅","37:REVOKE:INSUFFICIENT_SOURCE_PROVENANCE","38:REVOKE:INSUFFICIENT_SOURCE_PROVENANCE","39:REVOKE:INSUFFICIENT_SOURCE_PROVENANCE"],"publishStatus":"draft"}
OK  PRÉ · VINE-0xS-01 v2 PUBLIC, sceau 9074c4c7…, intact · PUBLIC 9074c4c7
OK  PRÉ · VINE-0xS-01 v1 ATTACHED, sceau 7fef4ea0… · ATTACHED 7fef4ea0
OK  PRÉ · VINE-0xS-02 v2 PUBLIC, sceau 2f6f77bf…, intact · PUBLIC 2f6f77bf
OK  PRÉ · VINE-0xS-02 v1 ATTACHED, sceau 10578c68… · ATTACHED 10578c68
OK  PRÉ · VINE-0xS-03 v2 PUBLIC, sceau 8ed3499d…, intact · PUBLIC 8ed3499d
OK  PRÉ · VINE-0xS-03 v1 ATTACHED, sceau 5f47e9f9… · ATTACHED 5f47e9f9
OK  PRÉ · décisions du dossier : exactement 16/17/18, GRANT, cause NULL, aucun REVOKE · ["16:GRANT","17:GRANT","18:GRANT"]
OK  PRÉ · dossier VINE en draft (second verrou intact) · draft
OK  REVOKE VINE-0xS-01 v2 → REVOKED · décision #37 · cause INSUFFICIENT_SOURCE_PROVENANCE · decided_at 2026-09-14T16:50:32.015Z
OK  REVOKE VINE-0xS-02 v2 → REVOKED · décision #38 · cause INSUFFICIENT_SOURCE_PROVENANCE · decided_at 2026-09-14T16:50:32.300Z
OK  REVOKE VINE-0xS-03 v2 → REVOKED · décision #39 · cause INSUFFICIENT_SOURCE_PROVENANCE · decided_at 2026-09-14T16:50:32.506Z
OK  GATE 1 · décisions 16/17/18 GRANT préservées, lignes byte-identiques
OK  GATE 2 · 3 nouvelles décisions, toutes REVOKE, une par claim v2, ids > 18, decided_by David Douville · ["37:VINE-0xS-01:2026-09-14 16:50:32.015+00","38:VINE-0xS-02:2026-09-14 16:50:32.3+00","39:VINE-0xS-03:2026-09-14 16:50:32.506+00"]
OK  GATE 3 · chaque REVOKE porte cause = INSUFFICIENT_SOURCE_PROVENANCE (colonne, relue)
OK  GATE 4 · les trois v2 sont ATTACHED · ["ATTACHED","ATTACHED","ATTACHED"]
OK  GATE 5 · sceaux v2 et v1 inchangés et intacts · [["v1:7fef4ea0","v2:9074c4c7"],["v1:10578c68","v2:2f6f77bf"],["v1:5f47e9f9","v2:8ed3499d"]]
OK  GATE 6 · projection brute : 0 PUBLIC pour ce lot (base) et 0 claim rendu (projection) · PUBLIC en base=0 · rendus=0 · retenus=[{"excluded":true,"reason":"EXCLUDED_FROM_PUBLICATION","field":"state","count":11}]
OK  GATE 7 · projection dossier REFUSÉE (publishStatus draft) · REFUSED · draft
OK  GATE 8 · aucune suppression ni réécriture : 22 claims, hors-lot md5 identique, 3 v2 identiques hors (state, updatedAt), 10 sources md5 identique, décisions 3 → 6 · claims 22→22 · sources md5 = · décisions 3→6
✅ points KO = 0
```

Décisions #37, #38, #39 (ids 19 à 36 consommés par les essais annulés des fenêtres précédentes : trous normaux, seul l'ordre compte). État final : 22 claims, 10 sources, 6 décisions, 0 PUBLIC, dossier VINE toujours `draft`, version servie 9ee790c inchangée.

## Non fait, à dessein

- Pas de `basis` libre (décision GPT 2).
- Journal de provenance intouché (mercredi) : son DDL devra perdre UNKNOWN de son domaine et sa contrainte `unknown_has_no_reference`.
- Aucun backfill, aucune requalification de pièce, aucune touche à CaseFileSource, aucun déploiement.
- `executor-e2e-pglite.mts` : sa pièce synthétique (sha « e »×64) est désormais UNKNOWN donc **non fondable** ; le script n'a pas été rejoué et ses scénarios positifs ne tiennent plus sans pièce qualifiée. Reprise quand le journal existe.
