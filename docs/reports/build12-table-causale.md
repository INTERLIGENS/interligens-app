# BUILD 12 — TABLE CAUSALE DES SURFACES DE PUBLICATION

Découverte en deux étages, jeu de racines le plus large (dossier · pièce · nominatif · proceeds · magasin hérité).
L'appartenance à un répertoire n'entre nulle part dans le calcul.

| surface | atteinte (racine) | émission gouvernée | nature | porte d'auth observée | gelé | point d'application |
|---|---|---|---|---|---|---|
| `src/app/api/admin/identity/queue/route.ts` | kolWallet | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/kol/[handle]/proceeds/status/route.ts` | sql-brut | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/admin/kol/publishability/batch/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/kol/watch-scan/route.ts` | kolEvidence | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/messages/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/ops/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/osint/process/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/stats/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/admin/watcher/summary/route.ts` | watcherCampaign | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/beta/auth/logout/route.ts` | investigatorAccess | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/casefile/route.ts` | tokenCaseFile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/cron/helius-scan/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/cron/intake-watch/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/cron/process-events/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/cron/watcher-v2/route.ts` | kolProfile | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/evidence/snapshots/route.ts` | evidenceSnapshot | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/explorer/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/investigator/alerts/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/investigator/auth/logout/route.ts` | investigatorAccess | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/investigator/kols/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/investigator/metrics/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/investigator/pdfs/download/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/investigator/proceeds/route.ts` | investigatorAccess | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/investigators/messages/[id]/route.ts` | investigatorAccess | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/investigators/messages/route.ts` | investigatorAccess | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/investigators/network-graph/route.ts` | investigatorProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/proceeds/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/kol/leaderboard/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/mobile/v1/ask/route.ts` | kolWallet | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/osint/submission/[id]/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/partner/v1/batch-score/route.ts` | magasin-herite | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/partner/v1/score-lite/route.ts` | magasin-herite | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/partner/v1/transaction-check/route.ts` | magasin-herite | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/pdf/casefile/route.ts` | magasin-herite | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/report/v2/route.ts` | magasin-herite | INDÉCIDABLE | — | oui | oui | export |
| `src/app/api/scan/ask/route.ts` | kolWallet | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/scan/evm/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/scan/solana/route.ts` | magasin-herite | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/telegram/webhook/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/v1/kol/route.ts` | kolProfile | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/v1/score/route.ts` | magasin-herite | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/watchlist/route.ts` | kolTokenLink | INDÉCIDABLE | — | AUCUNE | oui | export |
| `src/app/api/investigator/cases/route.ts` | investigatorAccess | NON | — | oui | oui | export |
| `src/app/api/investigator/pdfs/route.ts` | investigatorAccess | NON | — | oui | oui | export |
| `src/app/api/scan/cluster/route.ts` | kolWallet | NON | — | AUCUNE | oui | export |
| `src/app/en/demo/page.tsx` | consommation (type) | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/en/investigator/reflex/[id]/page.tsx` | kolProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/en/kol/[handle]/page.tsx` | consommation (type) | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/en/news/page.tsx` | kolProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/fr/demo/page.tsx` | consommation (type) | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/fr/investigator/reflex/[id]/page.tsx` | kolProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/fr/kol/[handle]/page.tsx` | consommation (type) | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/investigators/box/layout.tsx` | vaultProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/investigators/onboarding/pending/page.tsx` | investigatorProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/investigators/onboarding/welcome/page.tsx` | investigatorProfile | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/scan/page.tsx` | consommation (type) | NON | — | AUCUNE | non | corps (rendu) |
| `src/app/api/admin/access/route.ts` | investigatorAccess | OUI | JSON | oui | oui | export |
| `src/app/api/admin/export/botify/route.ts` | kolCase | OUI | JSON | oui | oui | export |
| `src/app/api/admin/graphs/[id]/publish/route.ts` | vaultNetworkGraph | OUI | JSON | oui | oui | export |
| `src/app/api/admin/identity/resolve/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/intake/[id]/actions/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/intake/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/intelligence/retraction/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/intelligence/retractions/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/activate-workspace/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/restore/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/revoke/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/suspend/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/[id]/upgrade-trusted/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/applications/[id]/review/route.ts` | investigatorApplication | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/applications/route.ts` | investigatorApplication | OUI | JSON | oui | oui | export |
| `src/app/api/admin/investigators/route.ts` | investigatorProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol-review/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol/[handle]/proceeds/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/admin/kol/evidence/route.ts` | kolEvidence | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol/investigate/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol/network/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/admin/kol/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol/sync-proceeds/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/kol/wallet/route.ts` | kolWallet | OUI | JSON | oui | oui | export |
| `src/app/api/admin/osint/commit/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/osint/retail/process-queue/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/pdf/list/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/plainte/generate/route.ts` | kolProfile | OUI | ARTEFACT | oui | oui | export |
| `src/app/api/admin/prebuy/verdict/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/snapshots/[entityValue]/route.ts` | scoreSnapshot | OUI | JSON | oui | oui | export |
| `src/app/api/admin/watch-sources/[id]/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/admin/watcher/campaigns/route.ts` | watcherCampaign | OUI | JSON | oui | oui | export |
| `src/app/api/beta/auth/login/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/casefile/generate/route.ts` | tokenCaseFile | OUI | ARTEFACT | oui | oui | export |
| `src/app/api/casefile/pdf/route.ts` | tokenCaseFile | OUI | ARTEFACT | oui | oui | export |
| `src/app/api/casefile/public/route.ts` | tokenCaseFile | OUI | ARTEFACT | AUCUNE | oui | export |
| `src/app/api/cluster/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/coordination/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/cron/daily-flow/route.ts` | kolWallet | OUI | JSON | oui | oui | export |
| `src/app/api/cron/retail-process-queue/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/cron/shill-feed/route.ts` | kolPromotionMention | OUI | JSON | oui | oui | export |
| `src/app/api/cron/watcher-bridge/route.ts` | sql-brut | OUI | JSON | oui | oui | export |
| `src/app/api/cron/weekly-digest/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/ingest/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/internal/pdf/regen/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/investigator/auth/login/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/activity/route.ts` | investigatorProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/apply/route.ts` | investigatorApplication | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/cases/[caseId]/ai-summary/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/assistant/route.ts` | vaultWorkspace | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/entities/[entityId]/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/entities/enrich/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/entities/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/entities/suggest/route.ts` | kolWallet | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/evidence-snapshots/route.ts` | vaultEvidenceSnapshot | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/exports/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/[fileId]/finalize/route.ts` | vaultCaseFile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/[fileId]/presign/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/[fileId]/route.ts` | vaultCaseEntity | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/[fileId]/url/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/draft/route.ts` | vaultCaseFile | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/files/route.ts` | vaultCaseFile | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/hypotheses/[hypothesisId]/route.ts` | vaultHypothesis | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/hypotheses/route.ts` | vaultHypothesis | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/intelligence-summary/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/notes/[noteId]/route.ts` | vaultCaseNote | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/notes/route.ts` | vaultCaseNote | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/publish-candidate/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/route.ts` | vaultCase | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/share/[shareId]/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/share/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/shares/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/timeline-events/[eventId]/route.ts` | vaultTimelineEvent | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/timeline-events/route.ts` | vaultTimelineEvent | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/[caseId]/timeline/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/cases/route.ts` | vaultCase | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/directory/route.ts` | vaultProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/entities/collisions/route.ts` | vaultCaseEntity | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/entities/search/route.ts` | vaultCaseEntity | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/feedback/route.ts` | investigatorSession | OUI | JSON | oui | oui | export |
| `src/app/api/investigators/graphs/[id]/route.ts` | vaultNetworkGraph | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/graphs/route.ts` | vaultNetworkGraph | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/identity/complete/route.ts` | investigatorProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/me/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/nda/accept/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/onboarding/nda/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/onboarding/workspace/route.ts` | vaultProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/profile/route.ts` | vaultProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/shill-timeline/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/terms/accept/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/workspace/metrics/route.ts` | vaultCase | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/investigators/workspace/salt/route.ts` | investigatorSession | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/cashout/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/class-action/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/pedigree/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/shill-to-exit/route.ts` | sql-brut | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/[handle]/wallet-history/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/kol/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/laundry/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/mobile/v1/scan/route.ts` | magasin-herite | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/osint/submit/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/pdf/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/pdf/kol/route.ts` | kolProfile | OUI | JSON | oui | oui | export |
| `src/app/api/reflex/[id]/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/reflex/route.ts` | kolCase | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/report/casefile/route.ts` | tokenCaseFile | OUI | ARTEFACT | oui | oui | export |
| `src/app/api/scan/grounding/route.ts` | kolWallet | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/stripe/webhook/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/token/[chain]/[address]/kol-alert/route.ts` | kolTokenInvolvement | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/v1/feedback/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/v1/kol/[handle]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/v1/scan-context/route.ts` | magasin-herite | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/v1/shill-to-exit/route.ts` | sql-brut | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/watch/[id]/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/watch/route.ts` | investigatorAccess | OUI | JSON | AUCUNE | oui | export |
| `src/app/api/watchlist/signals/[id]/route.ts` | kolProfile | OUI | JSON | AUCUNE | oui | export |
| `src/app/en/cases/botify/evidence/page.tsx` | tokenCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/en/cases/cbex/page.tsx` | platformCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/en/cases/lab/page.tsx` | tokenCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/en/cases/page.tsx` | platformCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/fr/cases/cbex/page.tsx` | platformCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/fr/cases/lab/page.tsx` | tokenCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/fr/cases/page.tsx` | platformCaseFile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/app/investigators/box/graph/demo/[slug]/page.tsx` | vaultProfile | OUI | HTML | AUCUNE | non | corps (rendu) |
| `src/components/pdf/pdfRenderer.ts` | consommation (type) | OUI | ARTEFACT | AUCUNE | oui | production d'artefact |
| `src/lib/casefile/pdfGenerator.ts` | consommation (type) | OUI | ARTEFACT | AUCUNE | non | production d'artefact |
| `src/lib/casefile/pdfGeneratorPublic.ts` | tokenCaseFile | OUI | ARTEFACT | AUCUNE | non | production d'artefact |
| `src/lib/digest/emailTemplate.ts` | consommation (type) | OUI | ARTEFACT | AUCUNE | non | production d'artefact |
| `src/lib/email/unifiedDigest.ts` | kolProfile | OUI | ARTEFACT | AUCUNE | non | production d'artefact |
| `src/lib/pdf/engine.ts` | kolProfile | OUI | ARTEFACT | AUCUNE | oui | production d'artefact |
| `src/lib/vault/iocExportPdf.ts` | consommation (type) | OUI | ARTEFACT | AUCUNE | non | production d'artefact |
| `src/scripts/seed/buildBotifyDossier.ts` | evidenceSnapshot | OUI | ARTEFACT | AUCUNE | non | production d'artefact |

## Décompte

- candidats étage A : **190**
- **N (émission gouvernée avérée) : 134**
- REACHES_AUTHORITY / NO_GOVERNED_EMISSION : 14
- INDÉCIDABLES : 42

N par nature : {"JSON":113,"ARTEFACT":13,"HTML":8}

N gelés : 120 / 134

N sans porte d'auth observée : 67
