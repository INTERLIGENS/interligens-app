# BUILD 12 — TABLE CAUSALE DES SURFACES DE PUBLICATION

Découverte en DEUX ÉTAGES. L'appartenance à un répertoire n'entre nulle part dans le calcul.

    A · CANDIDAT               surface observable qui PEUT ATTEINDRE l'autorité
    B · SURFACE DE PUBLICATION l'autorité PEUT COULER dans la charge émise

Racines : jeu le plus large — dossier · pièce · nominatif · proceeds · magasin hérité.
40 modèles sur 164, lus dans `prisma/schema.prod.prisma`.

| # | surface | source d'autorité | propriété gouvernée émise | sorties | audience observée | nature | décidable | gelé | point d'application |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/app/api/admin/kol/[handle]/proceeds/status/route.ts` | sql-brut | — | 9 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 2 | `src/app/api/admin/kol/publishability/batch/route.ts` | kolProfile | — | 4 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 3 | `src/app/api/admin/messages/route.ts` | investigatorAccess | — | 5 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 4 | `src/app/api/admin/osint/process/route.ts` | kolProfile | — | 5 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 5 | `src/app/api/investigator/alerts/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 6 | `src/app/api/investigator/metrics/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 7 | `src/app/api/investigator/proceeds/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 8 | `src/app/api/investigators/messages/[id]/route.ts` | investigatorAccess | — | 7 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 9 | `src/app/api/investigators/messages/route.ts` | investigatorAccess | — | 6 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 10 | `src/app/api/kol/[handle]/proceeds/route.ts` | kolProfile | — | 4 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 11 | `src/app/api/mobile/v1/ask/route.ts` | kolWallet | — | 6 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 12 | `src/app/api/osint/submission/[id]/route.ts` | kolProfile | — | 4 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 13 | `src/app/api/pdf/casefile/route.ts` | magasin-herite | — | 4 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 14 | `src/app/api/report/v2/route.ts` | magasin-herite | — | 2 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 15 | `src/app/api/scan/evm/route.ts` | kolProfile | — | 2 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 16 | `src/app/api/telegram/webhook/route.ts` | kolProfile | — | 5 | AUCUNE dans le handler | — | INDÉCIDABLE | oui | export |
| 17 | `src/app/api/admin/access/route.ts` | investigatorAccess | contenu + existence | 15 | porte dans le handler | JSON | oui | oui | export |
| 18 | `src/app/api/admin/export/botify/route.ts` | kolCase | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 19 | `src/app/api/admin/graphs/[id]/publish/route.ts` | vaultNetworkGraph | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 20 | `src/app/api/admin/identity/queue/route.ts` | kolWallet | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 21 | `src/app/api/admin/identity/resolve/route.ts` | kolProfile | contenu + existence | 16 | porte dans le handler | JSON | oui | oui | export |
| 22 | `src/app/api/admin/intake/[id]/actions/route.ts` | kolProfile | contenu | 10 | porte dans le handler | JSON | oui | oui | export |
| 23 | `src/app/api/admin/intake/route.ts` | kolProfile | contenu | 6 | porte dans le handler | JSON | oui | oui | export |
| 24 | `src/app/api/admin/intelligence/retraction/route.ts` | kolProfile | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 25 | `src/app/api/admin/intelligence/retractions/route.ts` | kolProfile | contenu | 5 | porte dans le handler | JSON | oui | oui | export |
| 26 | `src/app/api/admin/investigators/[id]/activate-workspace/route.ts` | investigatorProfile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 27 | `src/app/api/admin/investigators/[id]/restore/route.ts` | investigatorProfile | existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 28 | `src/app/api/admin/investigators/[id]/revoke/route.ts` | investigatorProfile | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 29 | `src/app/api/admin/investigators/[id]/route.ts` | investigatorProfile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 30 | `src/app/api/admin/investigators/[id]/suspend/route.ts` | investigatorProfile | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 31 | `src/app/api/admin/investigators/[id]/upgrade-trusted/route.ts` | investigatorProfile | contenu + existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 32 | `src/app/api/admin/investigators/applications/[id]/review/route.ts` | investigatorApplication | contenu + existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 33 | `src/app/api/admin/investigators/applications/route.ts` | investigatorApplication | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 34 | `src/app/api/admin/investigators/route.ts` | investigatorProfile | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 35 | `src/app/api/admin/kol-review/route.ts` | kolProfile | contenu | 7 | porte dans le handler | JSON | oui | oui | export |
| 36 | `src/app/api/admin/kol/[handle]/proceeds/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 37 | `src/app/api/admin/kol/evidence/route.ts` | kolEvidence | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 38 | `src/app/api/admin/kol/investigate/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 39 | `src/app/api/admin/kol/network/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 40 | `src/app/api/admin/kol/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 41 | `src/app/api/admin/kol/sync-proceeds/route.ts` | kolProfile | contenu + existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 42 | `src/app/api/admin/kol/wallet/route.ts` | kolWallet | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 43 | `src/app/api/admin/ops/route.ts` | kolProfile | contenu | 14 | porte dans le handler | JSON | oui | oui | export |
| 44 | `src/app/api/admin/osint/commit/route.ts` | kolProfile | contenu | 9 | porte dans le handler | JSON | oui | oui | export |
| 45 | `src/app/api/admin/osint/retail/process-queue/route.ts` | kolProfile | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 46 | `src/app/api/admin/pdf/list/route.ts` | kolProfile | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 47 | `src/app/api/admin/plainte/generate/route.ts` | kolProfile | contenu + existence | 5 | porte dans le handler | ARTEFACT | oui | oui | export |
| 48 | `src/app/api/admin/prebuy/verdict/route.ts` | kolProfile | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 49 | `src/app/api/admin/snapshots/[entityValue]/route.ts` | scoreSnapshot | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 50 | `src/app/api/admin/stats/route.ts` | investigatorAccess | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 51 | `src/app/api/admin/watch-sources/[id]/route.ts` | kolProfile | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 52 | `src/app/api/admin/watcher/campaigns/route.ts` | watcherCampaign | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 53 | `src/app/api/admin/watcher/summary/route.ts` | watcherCampaign | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 54 | `src/app/api/beta/auth/login/route.ts` | investigatorAccess | existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 55 | `src/app/api/casefile/generate/route.ts` | tokenCaseFile | contenu + existence | 6 | porte dans le handler | ARTEFACT | oui | oui | export |
| 56 | `src/app/api/casefile/pdf/route.ts` | tokenCaseFile | contenu | 10 | porte dans le handler | ARTEFACT | oui | oui | export |
| 57 | `src/app/api/casefile/public/route.ts` | tokenCaseFile | contenu + existence | 6 | AUCUNE dans le handler | ARTEFACT | oui | oui | export |
| 58 | `src/app/api/casefile/route.ts` | tokenCaseFile | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 59 | `src/app/api/cluster/[handle]/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 60 | `src/app/api/coordination/[handle]/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 61 | `src/app/api/cron/daily-flow/route.ts` | kolWallet | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 62 | `src/app/api/cron/retail-process-queue/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 63 | `src/app/api/cron/shill-feed/route.ts` | kolPromotionMention | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 64 | `src/app/api/cron/watcher-bridge/route.ts` | sql-brut | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 65 | `src/app/api/cron/weekly-digest/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 66 | `src/app/api/evidence/snapshots/route.ts` | evidenceSnapshot | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 67 | `src/app/api/explorer/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 68 | `src/app/api/ingest/route.ts` | kolProfile | contenu | 9 | porte dans le handler | JSON | oui | oui | export |
| 69 | `src/app/api/internal/pdf/regen/route.ts` | kolProfile | contenu | 5 | porte dans le handler | JSON | oui | oui | export |
| 70 | `src/app/api/investigator/auth/login/route.ts` | investigatorAccess | existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 71 | `src/app/api/investigators/activity/route.ts` | investigatorProfile | contenu + existence | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 72 | `src/app/api/investigators/apply/route.ts` | investigatorApplication | contenu | 8 | AUCUNE dans le handler | JSON | oui | oui | export |
| 73 | `src/app/api/investigators/cases/[caseId]/ai-summary/route.ts` | vaultCaseEntity | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 74 | `src/app/api/investigators/cases/[caseId]/assistant/route.ts` | vaultWorkspace | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 75 | `src/app/api/investigators/cases/[caseId]/entities/[entityId]/route.ts` | vaultCaseEntity | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 76 | `src/app/api/investigators/cases/[caseId]/entities/enrich/route.ts` | vaultCaseEntity | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 77 | `src/app/api/investigators/cases/[caseId]/entities/route.ts` | vaultCaseEntity | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 78 | `src/app/api/investigators/cases/[caseId]/entities/suggest/route.ts` | kolWallet | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 79 | `src/app/api/investigators/cases/[caseId]/evidence-snapshots/route.ts` | vaultEvidenceSnapshot | contenu + existence | 9 | porte dans le handler | JSON | oui | oui | export |
| 80 | `src/app/api/investigators/cases/[caseId]/exports/route.ts` | investigatorSession | contenu + existence | 7 | porte dans le handler | JSON | oui | oui | export |
| 81 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/finalize/route.ts` | vaultCaseFile | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 82 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/presign/route.ts` | investigatorSession | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 83 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/route.ts` | vaultCaseEntity | existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 84 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/url/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 85 | `src/app/api/investigators/cases/[caseId]/files/draft/route.ts` | vaultCaseFile | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 86 | `src/app/api/investigators/cases/[caseId]/files/route.ts` | vaultCaseFile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 87 | `src/app/api/investigators/cases/[caseId]/hypotheses/[hypothesisId]/route.ts` | vaultHypothesis | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 88 | `src/app/api/investigators/cases/[caseId]/hypotheses/route.ts` | vaultHypothesis | contenu + existence | 7 | porte dans le handler | JSON | oui | oui | export |
| 89 | `src/app/api/investigators/cases/[caseId]/intelligence-summary/route.ts` | investigatorSession | contenu + existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 90 | `src/app/api/investigators/cases/[caseId]/notes/[noteId]/route.ts` | vaultCaseNote | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 91 | `src/app/api/investigators/cases/[caseId]/notes/route.ts` | vaultCaseNote | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 92 | `src/app/api/investigators/cases/[caseId]/publish-candidate/route.ts` | vaultCaseEntity | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 93 | `src/app/api/investigators/cases/[caseId]/route.ts` | vaultCase | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 94 | `src/app/api/investigators/cases/[caseId]/share/[shareId]/route.ts` | investigatorSession | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 95 | `src/app/api/investigators/cases/[caseId]/share/route.ts` | investigatorSession | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 96 | `src/app/api/investigators/cases/[caseId]/shares/route.ts` | investigatorSession | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 97 | `src/app/api/investigators/cases/[caseId]/timeline-events/[eventId]/route.ts` | vaultTimelineEvent | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 98 | `src/app/api/investigators/cases/[caseId]/timeline-events/route.ts` | vaultTimelineEvent | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 99 | `src/app/api/investigators/cases/[caseId]/timeline/route.ts` | investigatorSession | existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 100 | `src/app/api/investigators/cases/route.ts` | vaultCase | contenu + existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 101 | `src/app/api/investigators/directory/route.ts` | vaultProfile | contenu | 1 | AUCUNE dans le handler | JSON | oui | oui | export |
| 102 | `src/app/api/investigators/entities/collisions/route.ts` | vaultCaseEntity | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 103 | `src/app/api/investigators/entities/search/route.ts` | vaultCaseEntity | contenu + existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 104 | `src/app/api/investigators/feedback/route.ts` | investigatorSession | existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 105 | `src/app/api/investigators/graphs/[id]/route.ts` | vaultNetworkGraph | contenu + existence | 14 | AUCUNE dans le handler | JSON | oui | oui | export |
| 106 | `src/app/api/investigators/graphs/route.ts` | vaultNetworkGraph | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 107 | `src/app/api/investigators/identity/complete/route.ts` | investigatorProfile | existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 108 | `src/app/api/investigators/me/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 109 | `src/app/api/investigators/nda/accept/route.ts` | investigatorSession | contenu + existence | 10 | AUCUNE dans le handler | JSON | oui | oui | export |
| 110 | `src/app/api/investigators/onboarding/nda/route.ts` | investigatorSession | existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 111 | `src/app/api/investigators/onboarding/workspace/route.ts` | vaultProfile | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 112 | `src/app/api/investigators/profile/route.ts` | vaultProfile | contenu + existence | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 113 | `src/app/api/investigators/shill-timeline/route.ts` | investigatorAccess | contenu + existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 114 | `src/app/api/investigators/terms/accept/route.ts` | investigatorSession | contenu + existence | 10 | AUCUNE dans le handler | JSON | oui | oui | export |
| 115 | `src/app/api/investigators/workspace/metrics/route.ts` | vaultCase | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 116 | `src/app/api/investigators/workspace/salt/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 117 | `src/app/api/kol/[handle]/cashout/route.ts` | kolProfile | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 118 | `src/app/api/kol/[handle]/class-action/route.ts` | kolProfile | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 119 | `src/app/api/kol/[handle]/pedigree/route.ts` | kolProfile | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 120 | `src/app/api/kol/[handle]/route.ts` | kolProfile | contenu | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 121 | `src/app/api/kol/[handle]/shill-to-exit/route.ts` | sql-brut | contenu | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 122 | `src/app/api/kol/[handle]/wallet-history/route.ts` | kolProfile | contenu | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 123 | `src/app/api/kol/leaderboard/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 124 | `src/app/api/kol/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 125 | `src/app/api/laundry/[handle]/route.ts` | kolProfile | existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 126 | `src/app/api/mobile/v1/scan/route.ts` | magasin-herite | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 127 | `src/app/api/osint/submit/route.ts` | kolProfile | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 128 | `src/app/api/partner/v1/transaction-check/route.ts` | magasin-herite | contenu | 9 | AUCUNE dans le handler | JSON | oui | oui | export |
| 129 | `src/app/api/pdf/[handle]/route.ts` | kolProfile | contenu + existence | 8 | AUCUNE dans le handler | JSON | oui | oui | export |
| 130 | `src/app/api/pdf/kol/route.ts` | kolProfile | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 131 | `src/app/api/reflex/[id]/route.ts` | investigatorAccess | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 132 | `src/app/api/reflex/route.ts` | kolCase | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 133 | `src/app/api/report/casefile/route.ts` | tokenCaseFile | contenu | 4 | porte dans le handler | ARTEFACT | oui | oui | export |
| 134 | `src/app/api/scan/grounding/route.ts` | kolWallet | contenu | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 135 | `src/app/api/scan/solana/route.ts` | magasin-herite | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 136 | `src/app/api/stripe/webhook/route.ts` | investigatorAccess | existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 137 | `src/app/api/token/[chain]/[address]/kol-alert/route.ts` | kolTokenInvolvement | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 138 | `src/app/api/v1/feedback/route.ts` | investigatorAccess | existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 139 | `src/app/api/v1/kol/[handle]/route.ts` | kolProfile | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 140 | `src/app/api/v1/kol/route.ts` | kolProfile | contenu | 1 | AUCUNE dans le handler | JSON | oui | oui | export |
| 141 | `src/app/api/v1/scan-context/route.ts` | magasin-herite | contenu | 9 | AUCUNE dans le handler | JSON | oui | oui | export |
| 142 | `src/app/api/v1/score/route.ts` | magasin-herite | contenu | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 143 | `src/app/api/v1/shill-to-exit/route.ts` | sql-brut | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 144 | `src/app/api/watch/[id]/route.ts` | investigatorAccess | existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 145 | `src/app/api/watch/route.ts` | investigatorAccess | existence | 9 | AUCUNE dans le handler | JSON | oui | oui | export |
| 146 | `src/app/api/watchlist/signals/[id]/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 147 | `src/app/en/cases/botify/evidence/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 148 | `src/app/en/cases/cbex/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 149 | `src/app/en/cases/lab/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 150 | `src/app/en/cases/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 151 | `src/app/fr/cases/cbex/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 152 | `src/app/fr/cases/lab/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 153 | `src/app/fr/cases/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 154 | `src/app/investigators/box/graph/demo/[slug]/page.tsx` | vaultProfile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 155 | `src/components/pdf/pdfRenderer.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | oui | production d'artefact |
| 156 | `src/lib/casefile/pdfGenerator.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 157 | `src/lib/casefile/pdfGeneratorPublic.ts` | tokenCaseFile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 158 | `src/lib/digest/emailTemplate.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 159 | `src/lib/email/unifiedDigest.ts` | kolProfile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 160 | `src/lib/pdf/engine.ts` | kolProfile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | oui | production d'artefact |
| 161 | `src/lib/vault/iocExportPdf.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 162 | `src/scripts/seed/buildBotifyDossier.ts` | evidenceSnapshot | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 163 | `src/app/api/admin/kol/watch-scan/route.ts` | kolEvidence | — | 3 | porte dans le handler | — | oui | oui | export |
| 164 | `src/app/api/beta/auth/logout/route.ts` | investigatorAccess | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 165 | `src/app/api/cron/helius-scan/route.ts` | kolProfile | — | 2 | porte dans le handler | — | oui | oui | export |
| 166 | `src/app/api/cron/intake-watch/route.ts` | kolProfile | — | 2 | porte dans le handler | — | oui | oui | export |
| 167 | `src/app/api/cron/process-events/route.ts` | kolProfile | — | 3 | porte dans le handler | — | oui | oui | export |
| 168 | `src/app/api/cron/watcher-v2/route.ts` | kolProfile | — | 5 | porte dans le handler | — | oui | oui | export |
| 169 | `src/app/api/investigator/auth/logout/route.ts` | investigatorAccess | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 170 | `src/app/api/investigator/cases/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | oui | oui | export |
| 171 | `src/app/api/investigator/kols/route.ts` | investigatorAccess | — | 3 | porte dans le handler | — | oui | oui | export |
| 172 | `src/app/api/investigator/pdfs/download/route.ts` | investigatorAccess | — | 4 | porte dans le handler | — | oui | oui | export |
| 173 | `src/app/api/investigator/pdfs/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | oui | oui | export |
| 174 | `src/app/api/investigators/network-graph/route.ts` | investigatorProfile | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 175 | `src/app/api/partner/v1/batch-score/route.ts` | magasin-herite | — | 8 | AUCUNE dans le handler | — | oui | oui | export |
| 176 | `src/app/api/partner/v1/score-lite/route.ts` | magasin-herite | — | 6 | AUCUNE dans le handler | — | oui | oui | export |
| 177 | `src/app/api/scan/ask/route.ts` | kolWallet | — | 4 | AUCUNE dans le handler | — | oui | oui | export |
| 178 | `src/app/api/scan/cluster/route.ts` | kolWallet | — | 6 | AUCUNE dans le handler | — | oui | oui | export |
| 179 | `src/app/api/watchlist/route.ts` | kolTokenLink | — | 2 | AUCUNE dans le handler | — | oui | oui | export |
| 180 | `src/app/en/demo/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 181 | `src/app/en/investigator/reflex/[id]/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 182 | `src/app/en/kol/[handle]/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 183 | `src/app/en/news/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 184 | `src/app/fr/demo/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 185 | `src/app/fr/investigator/reflex/[id]/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 186 | `src/app/fr/kol/[handle]/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 187 | `src/app/investigators/box/layout.tsx` | vaultProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 188 | `src/app/investigators/onboarding/pending/page.tsx` | investigatorProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 189 | `src/app/investigators/onboarding/welcome/page.tsx` | investigatorProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 190 | `src/app/scan/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |

## Décompte

| | |
|---|---|
| candidats étage A | **190** |
| **N_CONFIRMED** | **146** |
| N_INDECIDABLE (RED/HOLD) | **16** |
| N_NO_GOVERNED_EMISSION | 28 |

N par nature : JSON 125 · ARTEFACT 13 · HTML 8

N gelés : 132 / 146

## Réserves de méthode

- « audience observée » est une MESURE DE HANDLER. Une garde appliquée depuis `src/proxy.ts` n'y apparaît pas : ce chiffre est un PLAFOND d'exposition, pas un constat.
- Les INDÉCIDABLES ne sont pas comptées comme sûres. Elles restent RED/HOLD.
- L'étage A est délibérément sur-inclusif : manquer une surface coûte plus qu'en inclure une qui sera classée sans émission.
