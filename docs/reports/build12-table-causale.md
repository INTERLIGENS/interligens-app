# BUILD 12 — TABLE CAUSALE DES SURFACES DE PUBLICATION

Découverte en DEUX ÉTAGES. L'appartenance à un répertoire n'entre nulle part dans le calcul.

    A · CANDIDAT               surface observable qui PEUT ATTEINDRE l'autorité
    B · SURFACE DE PUBLICATION l'autorité PEUT COULER dans la charge émise

## Les racines, et comment elles sont trouvées

**GOVERNED DATA ROOTS ARE DISCOVERED BY THE CAPABILITY TO READ THE GOVERNED
PROPERTY, NOT BY MEMBERSHIP IN AN ORM SCHEMA.**

Trois magasins, trois capacités de lecture — aucune liste de tables tenue à la main :

| magasin | capacité reconnue | racines |
|---|---|---|
| ORM Prisma | `prisma.<modèle>.` sur un modèle gouverné | 40 modèles sur 164, `prisma/schema.prod.prisma` |
| SQL brut | tout site d'un des 8 mécanismes, toute clause | **30 tables**, dont **11 hors schéma ORM** |
| magasin hérité | lecture `fs` sur un chemin portant le segment `cases` | disque |

Balayage : `src/lib/governance/racinesSqlParCapacite.ts`. Garde :
`__tests__/governance/s24-racines-sql-par-capacite.test.ts`.

| # | surface | source d'autorité | propriété gouvernée émise | sorties | audience observée | nature | décidable | gelé | point d'application |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/app/admin/osint/dashboard/page.tsx` | sql-brut | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 2 | `src/app/admin/osint/review/page.tsx` | sql-brut | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 3 | `src/app/admin/watcher-drafts/page.tsx` | sql-brut | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 4 | `src/app/api/admin/access/route.ts` | investigatorAccess | contenu + existence | 15 | porte dans le handler | JSON | oui | oui | export |
| 5 | `src/app/api/admin/casefiles/generate/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 6 | `src/app/api/admin/export/botify/route.ts` | kolCase | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 7 | `src/app/api/admin/graphs/[id]/publish/route.ts` | vaultNetworkGraph | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 8 | `src/app/api/admin/identity/queue/route.ts` | kolWallet | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 9 | `src/app/api/admin/identity/resolve/route.ts` | kolProfile | contenu + existence | 16 | porte dans le handler | JSON | oui | oui | export |
| 10 | `src/app/api/admin/intake/[id]/actions/route.ts` | kolProfile | contenu | 10 | porte dans le handler | JSON | oui | oui | export |
| 11 | `src/app/api/admin/intake/route.ts` | kolProfile | contenu | 6 | porte dans le handler | JSON | oui | oui | export |
| 12 | `src/app/api/admin/intelligence/contradictions/route.ts` | sql-brut | contenu | 5 | porte dans le handler | JSON | oui | oui | export |
| 13 | `src/app/api/admin/intelligence/cross-links/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 14 | `src/app/api/admin/intelligence/retraction/route.ts` | sql-brut | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 15 | `src/app/api/admin/intelligence/retractions/route.ts` | sql-brut | contenu | 5 | porte dans le handler | JSON | oui | oui | export |
| 16 | `src/app/api/admin/intelligence/serial-patterns/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 17 | `src/app/api/admin/investigators/[id]/activate-workspace/route.ts` | investigatorProfile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 18 | `src/app/api/admin/investigators/[id]/restore/route.ts` | investigatorProfile | existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 19 | `src/app/api/admin/investigators/[id]/revoke/route.ts` | investigatorProfile | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 20 | `src/app/api/admin/investigators/[id]/route.ts` | investigatorProfile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 21 | `src/app/api/admin/investigators/[id]/suspend/route.ts` | investigatorProfile | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 22 | `src/app/api/admin/investigators/[id]/upgrade-trusted/route.ts` | investigatorProfile | contenu + existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 23 | `src/app/api/admin/investigators/applications/[id]/review/route.ts` | investigatorApplication | contenu + existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 24 | `src/app/api/admin/investigators/applications/route.ts` | investigatorApplication | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 25 | `src/app/api/admin/investigators/route.ts` | investigatorProfile | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 26 | `src/app/api/admin/kol-review/route.ts` | kolProfile | contenu | 7 | porte dans le handler | JSON | oui | oui | export |
| 27 | `src/app/api/admin/kol/[handle]/proceeds/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 28 | `src/app/api/admin/kol/[handle]/proceeds/status/route.ts` | sql-brut | contenu + existence | 9 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 29 | `src/app/api/admin/kol/evidence/route.ts` | kolEvidence | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 30 | `src/app/api/admin/kol/investigate/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 31 | `src/app/api/admin/kol/network/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 32 | `src/app/api/admin/kol/publishability/batch/route.ts` | kolProfile | contenu + existence | 4 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 33 | `src/app/api/admin/kol/publishability/route.ts` | sql-brut | contenu | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 34 | `src/app/api/admin/kol/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 35 | `src/app/api/admin/kol/sync-proceeds/route.ts` | kolProfile | contenu + existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 36 | `src/app/api/admin/kol/wallet/route.ts` | kolWallet | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 37 | `src/app/api/admin/messages/route.ts` | investigatorAccess | existence | 5 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 38 | `src/app/api/admin/onchain/ingest-historical/route.ts` | sql-brut | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 39 | `src/app/api/admin/onchain/status/route.ts` | sql-brut | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 40 | `src/app/api/admin/onchain/sync/route.ts` | sql-brut | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 41 | `src/app/api/admin/ops/route.ts` | kolProfile | contenu | 14 | porte dans le handler | JSON | oui | oui | export |
| 42 | `src/app/api/admin/osint/commit/route.ts` | kolProfile | contenu | 9 | porte dans le handler | JSON | oui | oui | export |
| 43 | `src/app/api/admin/osint/process/route.ts` | kolProfile | contenu + existence | 5 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 44 | `src/app/api/admin/osint/retail/process-queue/route.ts` | kolProfile | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 45 | `src/app/api/admin/osint/review/escalate/route.ts` | sql-brut | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 46 | `src/app/api/admin/osint/review/reject/route.ts` | sql-brut | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 47 | `src/app/api/admin/osint/review/resolve/route.ts` | sql-brut | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 48 | `src/app/api/admin/pdf/list/route.ts` | kolProfile | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 49 | `src/app/api/admin/plainte/generate/route.ts` | kolProfile | contenu + existence | 5 | porte dans le handler | ARTEFACT | oui | oui | export |
| 50 | `src/app/api/admin/prebuy/verdict/route.ts` | kolProfile | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 51 | `src/app/api/admin/snapshots/[entityValue]/route.ts` | scoreSnapshot | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 52 | `src/app/api/admin/stats/route.ts` | investigatorAccess | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 53 | `src/app/api/admin/watch-sources/[id]/route.ts` | kolProfile | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 54 | `src/app/api/admin/watcher-drafts/[id]/approve/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 55 | `src/app/api/admin/watcher-drafts/[id]/archive/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 56 | `src/app/api/admin/watcher-drafts/[id]/reject/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 57 | `src/app/api/admin/watcher/campaigns/route.ts` | watcherCampaign | contenu | 4 | porte dans le handler | JSON | oui | oui | export |
| 58 | `src/app/api/admin/watcher/summary/route.ts` | watcherCampaign | contenu | 1 | porte dans le handler | JSON | oui | oui | export |
| 59 | `src/app/api/beta/auth/login/route.ts` | investigatorAccess | existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 60 | `src/app/api/casefile/generate/route.ts` | tokenCaseFile | contenu + existence | 6 | porte dans le handler | ARTEFACT | oui | oui | export |
| 61 | `src/app/api/casefile/pdf/route.ts` | tokenCaseFile | contenu | 10 | porte dans le handler | ARTEFACT | oui | oui | export |
| 62 | `src/app/api/casefile/public/route.ts` | tokenCaseFile | contenu + existence | 6 | AUCUNE dans le handler | ARTEFACT | oui | oui | export |
| 63 | `src/app/api/casefile/route.ts` | tokenCaseFile | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 64 | `src/app/api/cluster/[handle]/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 65 | `src/app/api/coordination/[handle]/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 66 | `src/app/api/cron/daily-flow/route.ts` | kolWallet | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 67 | `src/app/api/cron/onchain/sync/route.ts` | sql-brut | contenu | 2 | porte dans le handler | JSON | oui | oui | export |
| 68 | `src/app/api/cron/retail-process-queue/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 69 | `src/app/api/cron/shill-feed/route.ts` | kolPromotionMention | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 70 | `src/app/api/cron/watcher-bridge/route.ts` | sql-brut | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 71 | `src/app/api/cron/weekly-digest/route.ts` | kolProfile | contenu | 3 | porte dans le handler | JSON | oui | oui | export |
| 72 | `src/app/api/evidence/snapshots/route.ts` | evidenceSnapshot | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 73 | `src/app/api/explorer/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 74 | `src/app/api/ingest/route.ts` | kolProfile | contenu | 9 | porte dans le handler | JSON | oui | oui | export |
| 75 | `src/app/api/internal/pdf/regen/route.ts` | kolProfile | contenu | 5 | porte dans le handler | JSON | oui | oui | export |
| 76 | `src/app/api/investigator/alerts/route.ts` | investigatorAccess | contenu | 1 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 77 | `src/app/api/investigator/auth/login/route.ts` | investigatorAccess | existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 78 | `src/app/api/investigator/proceeds/route.ts` | investigatorAccess | contenu | 1 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 79 | `src/app/api/investigators/activity/route.ts` | investigatorProfile | contenu + existence | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 80 | `src/app/api/investigators/apply/route.ts` | investigatorApplication | contenu | 8 | AUCUNE dans le handler | JSON | oui | oui | export |
| 81 | `src/app/api/investigators/cases/[caseId]/ai-summary/route.ts` | vaultCaseEntity | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 82 | `src/app/api/investigators/cases/[caseId]/assistant/route.ts` | vaultWorkspace | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 83 | `src/app/api/investigators/cases/[caseId]/entities/[entityId]/route.ts` | vaultCaseEntity | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 84 | `src/app/api/investigators/cases/[caseId]/entities/enrich/route.ts` | vaultCaseEntity | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 85 | `src/app/api/investigators/cases/[caseId]/entities/route.ts` | vaultCaseEntity | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 86 | `src/app/api/investigators/cases/[caseId]/entities/suggest/route.ts` | kolWallet | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 87 | `src/app/api/investigators/cases/[caseId]/evidence-snapshots/route.ts` | vaultEvidenceSnapshot | contenu + existence | 9 | porte dans le handler | JSON | oui | oui | export |
| 88 | `src/app/api/investigators/cases/[caseId]/exports/route.ts` | investigatorSession | contenu + existence | 7 | porte dans le handler | JSON | oui | oui | export |
| 89 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/finalize/route.ts` | vaultCaseFile | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 90 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/presign/route.ts` | investigatorSession | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 91 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/route.ts` | vaultCaseEntity | existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 92 | `src/app/api/investigators/cases/[caseId]/files/[fileId]/url/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 93 | `src/app/api/investigators/cases/[caseId]/files/draft/route.ts` | vaultCaseFile | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 94 | `src/app/api/investigators/cases/[caseId]/files/route.ts` | vaultCaseFile | contenu + existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 95 | `src/app/api/investigators/cases/[caseId]/hypotheses/[hypothesisId]/route.ts` | vaultHypothesis | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 96 | `src/app/api/investigators/cases/[caseId]/hypotheses/route.ts` | vaultHypothesis | contenu + existence | 7 | porte dans le handler | JSON | oui | oui | export |
| 97 | `src/app/api/investigators/cases/[caseId]/intelligence-summary/route.ts` | investigatorSession | contenu + existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 98 | `src/app/api/investigators/cases/[caseId]/notes/[noteId]/route.ts` | vaultCaseNote | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 99 | `src/app/api/investigators/cases/[caseId]/notes/route.ts` | vaultCaseNote | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 100 | `src/app/api/investigators/cases/[caseId]/publish-candidate/route.ts` | vaultCaseEntity | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 101 | `src/app/api/investigators/cases/[caseId]/route.ts` | vaultCase | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 102 | `src/app/api/investigators/cases/[caseId]/share/[shareId]/route.ts` | investigatorSession | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 103 | `src/app/api/investigators/cases/[caseId]/share/route.ts` | investigatorSession | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 104 | `src/app/api/investigators/cases/[caseId]/shares/route.ts` | investigatorSession | existence | 3 | porte dans le handler | JSON | oui | oui | export |
| 105 | `src/app/api/investigators/cases/[caseId]/timeline-events/[eventId]/route.ts` | vaultTimelineEvent | contenu + existence | 6 | porte dans le handler | JSON | oui | oui | export |
| 106 | `src/app/api/investigators/cases/[caseId]/timeline-events/route.ts` | vaultTimelineEvent | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 107 | `src/app/api/investigators/cases/[caseId]/timeline/route.ts` | investigatorSession | existence | 2 | porte dans le handler | JSON | oui | oui | export |
| 108 | `src/app/api/investigators/cases/route.ts` | vaultCase | contenu + existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 109 | `src/app/api/investigators/directory/route.ts` | vaultProfile | contenu | 1 | AUCUNE dans le handler | JSON | oui | oui | export |
| 110 | `src/app/api/investigators/entities/collisions/route.ts` | vaultCaseEntity | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 111 | `src/app/api/investigators/entities/search/route.ts` | vaultCaseEntity | contenu + existence | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 112 | `src/app/api/investigators/feedback/route.ts` | investigatorSession | existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 113 | `src/app/api/investigators/graphs/[id]/route.ts` | vaultNetworkGraph | contenu + existence | 14 | AUCUNE dans le handler | JSON | oui | oui | export |
| 114 | `src/app/api/investigators/graphs/route.ts` | vaultNetworkGraph | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 115 | `src/app/api/investigators/identity/complete/route.ts` | investigatorProfile | existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 116 | `src/app/api/investigators/me/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 117 | `src/app/api/investigators/messages/[id]/route.ts` | investigatorAccess | contenu + existence | 7 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 118 | `src/app/api/investigators/messages/route.ts` | investigatorAccess | contenu + existence | 6 | porte dans le handler | JSON | oui (lecture humaine) | oui | export |
| 119 | `src/app/api/investigators/nda/accept/route.ts` | investigatorSession | contenu + existence | 10 | AUCUNE dans le handler | JSON | oui | oui | export |
| 120 | `src/app/api/investigators/onboarding/nda/route.ts` | investigatorSession | existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 121 | `src/app/api/investigators/onboarding/workspace/route.ts` | vaultProfile | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 122 | `src/app/api/investigators/profile/route.ts` | vaultProfile | contenu + existence | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 123 | `src/app/api/investigators/shill-timeline/route.ts` | investigatorAccess | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 124 | `src/app/api/investigators/terms/accept/route.ts` | investigatorSession | contenu + existence | 10 | AUCUNE dans le handler | JSON | oui | oui | export |
| 125 | `src/app/api/investigators/workspace/metrics/route.ts` | vaultCase | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 126 | `src/app/api/investigators/workspace/salt/route.ts` | investigatorSession | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 127 | `src/app/api/kol/[handle]/cashout/route.ts` | kolProfile | contenu + existence | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 128 | `src/app/api/kol/[handle]/class-action/route.ts` | kolProfile | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 129 | `src/app/api/kol/[handle]/pedigree/route.ts` | kolProfile | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 130 | `src/app/api/kol/[handle]/proceeds/route.ts` | kolProfile | contenu + existence | 4 | AUCUNE dans le handler | JSON | oui (lecture humaine) | oui | export |
| 131 | `src/app/api/kol/[handle]/route.ts` | kolProfile | contenu | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 132 | `src/app/api/kol/[handle]/shill-to-exit/route.ts` | sql-brut | contenu | 4 | AUCUNE dans le handler | JSON | oui | oui | export |
| 133 | `src/app/api/kol/[handle]/wallet-history/route.ts` | kolProfile | contenu | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 134 | `src/app/api/kol/leaderboard/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 135 | `src/app/api/kol/route.ts` | kolProfile | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 136 | `src/app/api/laundry/[handle]/route.ts` | kolProfile | existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 137 | `src/app/api/mobile/v1/ask/route.ts` | kolWallet | contenu | 6 | AUCUNE dans le handler | JSON | oui (lecture humaine) | oui | export |
| 138 | `src/app/api/mobile/v1/scan/route.ts` | magasin-herite | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 139 | `src/app/api/osint/submission/[id]/route.ts` | kolProfile | existence | 4 | AUCUNE dans le handler | JSON | oui (lecture humaine) | oui | export |
| 140 | `src/app/api/osint/submit/route.ts` | kolProfile | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 141 | `src/app/api/partner/v1/transaction-check/route.ts` | magasin-herite | contenu | 9 | AUCUNE dans le handler | JSON | oui | oui | export |
| 142 | `src/app/api/pdf/[handle]/route.ts` | kolProfile | contenu + existence | 8 | porte dans le handler | JSON | oui | oui | export |
| 143 | `src/app/api/pdf/kol/route.ts` | kolProfile | contenu + existence | 5 | porte dans le handler | JSON | oui | oui | export |
| 144 | `src/app/api/reflex/[id]/route.ts` | investigatorAccess | contenu + existence | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 145 | `src/app/api/reflex/route.ts` | kolCase | contenu | 6 | AUCUNE dans le handler | JSON | oui | oui | export |
| 146 | `src/app/api/report/casefile/route.ts` | tokenCaseFile | contenu | 4 | porte dans le handler | ARTEFACT | oui | oui | export |
| 147 | `src/app/api/scan/grounding/route.ts` | kolWallet | contenu | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 148 | `src/app/api/scan/resolve/route.ts` | sql-brut | existence | 2 | AUCUNE dans le handler | JSON | oui (lecture humaine) | oui | export |
| 149 | `src/app/api/scan/solana/route.ts` | magasin-herite | contenu | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 150 | `src/app/api/stripe/webhook/route.ts` | investigatorAccess | existence | 5 | AUCUNE dans le handler | JSON | oui | oui | export |
| 151 | `src/app/api/token/[chain]/[address]/kol-alert/route.ts` | kolTokenInvolvement | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 152 | `src/app/api/v1/feedback/route.ts` | investigatorAccess | existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 153 | `src/app/api/v1/kol/[handle]/route.ts` | kolProfile | contenu + existence | 2 | AUCUNE dans le handler | JSON | oui | oui | export |
| 154 | `src/app/api/v1/kol/route.ts` | kolProfile | contenu | 1 | AUCUNE dans le handler | JSON | oui | oui | export |
| 155 | `src/app/api/v1/scan-context/route.ts` | magasin-herite | contenu | 9 | AUCUNE dans le handler | JSON | oui | oui | export |
| 156 | `src/app/api/v1/score/route.ts` | magasin-herite | contenu | 7 | AUCUNE dans le handler | JSON | oui | oui | export |
| 157 | `src/app/api/v1/shill-to-exit/route.ts` | sql-brut | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 158 | `src/app/api/watch/[id]/route.ts` | investigatorAccess | existence | 4 | porte dans le handler | JSON | oui | oui | export |
| 159 | `src/app/api/watch/route.ts` | investigatorAccess | existence | 9 | porte dans le handler | JSON | oui | oui | export |
| 160 | `src/app/api/watchlist/signals/[id]/route.ts` | kolProfile | contenu | 3 | AUCUNE dans le handler | JSON | oui | oui | export |
| 161 | `src/app/en/cases/botify/evidence/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 162 | `src/app/en/cases/cbex/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 163 | `src/app/en/cases/lab/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 164 | `src/app/en/cases/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 165 | `src/app/fr/cases/cbex/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 166 | `src/app/fr/cases/lab/page.tsx` | tokenCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 167 | `src/app/fr/cases/page.tsx` | platformCaseFile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 168 | `src/app/investigators/box/graph/demo/[slug]/page.tsx` | vaultProfile | rendu HTML | 0 | AUCUNE dans le handler | HTML | oui | non | corps (rendu) |
| 169 | `src/components/pdf/pdfRenderer.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | oui | production d'artefact |
| 170 | `src/lib/casefile/pdfGenerator.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 171 | `src/lib/casefile/pdfGeneratorPublic.ts` | tokenCaseFile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 172 | `src/lib/digest/emailTemplate.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 173 | `src/lib/email/unifiedDigest.ts` | kolProfile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 174 | `src/lib/pdf/engine.ts` | kolProfile | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | oui | production d'artefact |
| 175 | `src/lib/surveillance/reports/generateCaseFile.ts` | sql-brut | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 176 | `src/lib/vault/iocExportPdf.ts` | consommation (type) | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 177 | `src/scripts/seed/buildBotifyDossier.ts` | evidenceSnapshot | artefact | 0 | AUCUNE dans le handler | ARTEFACT | oui | non | production d'artefact |
| 178 | `src/app/api/admin/casefiles/[id]/route.ts` | sql-brut | — | 2 | porte dans le handler | — | oui | oui | export |
| 179 | `src/app/api/admin/kol/watch-scan/route.ts` | kolEvidence | — | 3 | porte dans le handler | — | oui | oui | export |
| 180 | `src/app/api/beta/auth/logout/route.ts` | investigatorAccess | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 181 | `src/app/api/cron/helius-scan/route.ts` | kolProfile | — | 2 | porte dans le handler | — | oui | oui | export |
| 182 | `src/app/api/cron/intake-watch/route.ts` | kolProfile | — | 2 | porte dans le handler | — | oui | oui | export |
| 183 | `src/app/api/cron/process-events/route.ts` | kolProfile | — | 3 | porte dans le handler | — | oui | oui | export |
| 184 | `src/app/api/cron/watcher-v2/route.ts` | kolProfile | — | 5 | porte dans le handler | — | oui | oui | export |
| 185 | `src/app/api/investigator/auth/logout/route.ts` | investigatorAccess | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 186 | `src/app/api/investigator/cases/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | oui | oui | export |
| 187 | `src/app/api/investigator/kols/route.ts` | investigatorAccess | — | 3 | porte dans le handler | — | oui | oui | export |
| 188 | `src/app/api/investigator/metrics/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | oui (lecture humaine) | oui | export |
| 189 | `src/app/api/investigator/pdfs/download/route.ts` | investigatorAccess | — | 4 | porte dans le handler | — | oui | oui | export |
| 190 | `src/app/api/investigator/pdfs/route.ts` | investigatorAccess | — | 1 | porte dans le handler | — | oui | oui | export |
| 191 | `src/app/api/investigators/network-graph/route.ts` | investigatorProfile | — | 1 | AUCUNE dans le handler | — | oui | oui | export |
| 192 | `src/app/api/partner/v1/batch-score/route.ts` | magasin-herite | — | 8 | AUCUNE dans le handler | — | oui | oui | export |
| 193 | `src/app/api/partner/v1/score-lite/route.ts` | magasin-herite | — | 6 | AUCUNE dans le handler | — | oui | oui | export |
| 194 | `src/app/api/scan/ask/route.ts` | kolWallet | — | 4 | AUCUNE dans le handler | — | oui | oui | export |
| 195 | `src/app/api/scan/cluster/route.ts` | kolWallet | — | 6 | AUCUNE dans le handler | — | oui | oui | export |
| 196 | `src/app/api/scan/evm/route.ts` | kolProfile | — | 2 | AUCUNE dans le handler | — | oui (lecture humaine) | oui | export |
| 197 | `src/app/api/telegram/webhook/route.ts` | kolProfile | — | 5 | AUCUNE dans le handler | — | oui (lecture humaine) | oui | export |
| 198 | `src/app/api/watchlist/route.ts` | kolTokenLink | — | 2 | AUCUNE dans le handler | — | oui | oui | export |
| 199 | `src/app/en/demo/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 200 | `src/app/en/investigator/reflex/[id]/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 201 | `src/app/en/kol/[handle]/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 202 | `src/app/en/news/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 203 | `src/app/fr/demo/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 204 | `src/app/fr/investigator/reflex/[id]/page.tsx` | kolProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 205 | `src/app/fr/kol/[handle]/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 206 | `src/app/investigators/box/layout.tsx` | vaultProfile | — | 0 | porte dans le handler | — | oui | non | corps (rendu) |
| 207 | `src/app/investigators/onboarding/pending/page.tsx` | investigatorProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 208 | `src/app/investigators/onboarding/welcome/page.tsx` | investigatorProfile | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 209 | `src/app/scan/page.tsx` | consommation (type) | — | 0 | AUCUNE dans le handler | — | oui | non | corps (rendu) |
| 210 | `src/app/api/pdf/casefile/route.ts` | magasin-herite | — | 4 | porte dans le handler | — | INDÉCIDABLE | oui | export |
| 211 | `src/app/api/report/v2/route.ts` | magasin-herite | — | 2 | porte dans le handler | — | INDÉCIDABLE | oui | export |

## Décompte

| | | delta vs build12 |
|---|---|---|
| candidats étage A | **211** | +21 |
| **N_CONFIRMED** | **177** | **+31** (146 → 177) |
| N_INDECIDABLE (RED/HOLD) | **2** | −14 (16 → 2) |
| N_NO_GOVERNED_EMISSION | 32 | +4 (28 → 32) |

N par nature : ARTEFACT 14 · HTML 11 · JSON 152

N gelés : 159 / 177

## Les deux indécidables qui restent

Elles ne sont pas indécidables par mesure : elles sont **NON LUES**. La consigne
de session excluait explicitement `pdf/casefile`, `casefile/generate` et
`report/v2`. Aucune n'a été ouverte, aucune n'a été tranchée. C'est une borne
de périmètre, pas une limite de méthode — et elles restent RED/HOLD.

| surface | statut |
|---|---|
| `src/app/api/pdf/casefile/route.ts` | HORS PÉRIMÈTRE de cette session (consigne explicite) — non lue, non tranchée |
| `src/app/api/report/v2/route.ts` | HORS PÉRIMÈTRE de cette session (consigne explicite) — non lue, non tranchée |

## Les 15 indécidables tranchées par lecture humaine

Aucune n'était un cas difficile. Les blocages étaient cinq lacunes de LIAISON
dans la sonde — un identifiant lié par `catch (e)`, par déstructuration
(`const { handle } = await params`), par paramètre de flèche (`.map((c) => …)`),
un mot de TypeScript en position de type (`as`, `unknown`, `BodyInit`), ou un
import. La sonde ne savait pas que ces identifiants étaient liés, donc elle
refusait de conclure. Aucune ne relevait d'une ambiguïté réelle du code.

| surface | issue | propriété | chemin de la valeur jusqu'à la sortie |
|---|---|---|---|
| `api/admin/kol/[handle]/proceeds/status/route.ts` | **ÉMET** | contenu + existence | $queryRaw KolProceedsSummary/KolProceedsEvent → rows → s → json{reviewNote, totalProceedsUsd, coverageNote, pricingSourceBreakdown} ; {found:false,handle} divulgue l'absence |
| `api/admin/kol/publishability/batch/route.ts` | **ÉMET** | contenu + existence | kolProfile/kolWallet/kolCase → caseRecords → checkPublishability → blockers[] cite `Case ${caseId}` et la formulation prohibée trouvée dans notes/evidence/label ; handle absent ⇒ omis du résultat |
| `api/admin/messages/route.ts` | **ÉMET** | existence | conversation.participants → c.participants.map(p=>p.accessId) → json ; POST : investigatorAccess{isActive} → actives → count |
| `api/admin/osint/process/route.ts` | **ÉMET** | contenu + existence | processSubmission(store=prismaStore) → ProcessResult{imageSha256, submissionId, idempotent, claims[]} → json |
| `api/investigator/alerts/route.ts` | **ÉMET** | contenu | PUBLISHED_ALERTS (registre en code) → getPublishedAlerts() → json{alerts[].entity, entityHandle, signalType} |
| `api/investigator/proceeds/route.ts` | **ÉMET** | contenu | PUBLISHED_PROCEEDS (registre en code) → getPublishedProceeds() → json{entityId='GordonGekko', walletShort, usdValue} |
| `api/investigators/messages/[id]/route.ts` | **ÉMET** | contenu + existence | conversation.messages → m.senderAccessId, m.senderName, m.body (entier) → json |
| `api/investigators/messages/route.ts` | **ÉMET** | contenu + existence | participants→accessId ; messages[0].senderName (= session.label à l'écriture) et body(0,100) → json |
| `api/kol/[handle]/proceeds/route.ts` | **ÉMET** | contenu + existence | $queryRaw KolProceedsSummary → s → json{totalProceedsUsd, proceedsByYear, topWalletLabel, largestEventUsd, rolling*} |
| `api/mobile/v1/ask/route.ts` | **ÉMET** | contenu | kolWallet{address} → kolHandle → buildGroundingContext → kolContext (handle, proceedsSummary, evidenceDepth, laundryTrail) → buildSystemPrompt → messages.create → text → stripMarkdown → json. CONDITIONNEMENT DE MODÈLE, pas recopie. |
| `api/osint/submission/[id]/route.ts` | **ÉMET** | existence | getBatchStatusRows(OsintSubmission) → 404 vs 200 divulgue l'existence du lot ; images[].status (dont DUPLICATE) divulgue l'état du corpus de pièces |
| `api/scan/resolve/route.ts` | **ÉMET** | existence | $queryRawUnsafe KolTokenLink(visibility='public') + KolPromotionMention → rows[].kolHandle → g.handles:Set → kolCount=size → serialize() → candidates[] |
| `api/investigator/metrics/route.ts` | N'ÉMET PAS | — | cinq scalaires — 4 cardinalités et une somme sur 4 entrées ; aucune propriété attribuable à un sujet identifié |
| `api/scan/evm/route.ts` | N'ÉMET PAS | — | seul lien à une racine : emitScanCompleted(address,chain,score), écriture dont la valeur de retour est jetée ; la charge vient du moteur TigerScore, de la liste KNOWN_BAD en code et de IntelligenceResult (slugs/poids/drapeaux, aucun sujet nommé) |
| `api/telegram/webhook/route.ts` | N'ÉMET PAS | — | toute réponse HTTP vaut {ok:true} ; le matériel gouverné part par l'API Bot Telegram — canal sortant que le modèle d'émission de build12 ne mesure pas |

## Réserves de méthode

- **Aucun chiffre d'exposition n'est publié dans ce document.** « audience
  observée » est une MESURE DE HANDLER : une garde appliquée depuis
  `src/proxy.ts` n'y apparaît pas. T1 a qualifié les huit routes kol et montré
  qu'aucune n'est atteignable en anonyme — sept fermées par le proxy
  (401 NOMINATIVE_ACCESS_REQUIRED), une par sa propre garde. Le chiffre agrégé
  serait donc faux dans un sens connu ; il sera relu sur N = 177 quand T1
  aura qualifié le matcher, pas avant.
- `kol/[handle]/pedigree` figure comme émission gouvernée à audience
  nominative, pas comme candidat : c'est la seule des sept à lire la table SANS
  filtre de publication et à rendre un profil NON PUBLIÉ en entier
  (publishStatus, displayName, label, wallets, cashoutLog). Qualification T1.
- `wallet_sync_state` est retenue comme racine par SUR-INCLUSION : la table
  n'existe pas en production (vérifié le 2026-09-12 par `information_schema`).
  Elle porte 4 surfaces. **Sans elle, N = 173.**
- `mobile/v1/ask` émet par CONDITIONNEMENT DE MODÈLE, pas par recopie : le
  matériel gouverné est posé dans l'invite système, la réponse du modèle est
  servie. La teinte ne se suit pas mécaniquement — la définition d'étage B est
  possibiliste (« PEUT couler »), et elle est satisfaite.
- `telegram/webhook` ne publie rien **par HTTP** ; le matériel gouverné sort
  par l'API Bot Telegram. Le modèle d'émission de build12 ne reconnaît que
  trois formes — réponse HTTP, HTML rendu, objet écrit en R2. **Un canal
  sortant est une quatrième forme, non mesurée.**
- L'étage A reste délibérément sur-inclusif : manquer une surface coûte plus
  qu'en inclure une qui sera classée sans émission.
- Observation non classée : la requête `KolPromotionMention` de
  `scan/resolve` n'a pas de filtre de visibilité, là où la requête
  `KolTokenLink` de la même fonction exige `visibility = 'public'`. Seul un
  `kolCount` en sort. Constat de mesure — aucune classification d'audience.

## Annexe — les racines atteintes en SQL brut

320 sites de SQL brut dans `src` + `scripts` + `prisma` + `__tests__`, huit
mécanismes, 55 tables distinctes touchées. Classées : **30 portent une propriété
gouvernée**, 25 non.

### Les 11 gouvernées HORS SCHÉMA ORM

Une découverte partant du schéma ne voit aucune de ces lignes.

| table | classe | reconnue par | lectures | en production | à l'inventaire précédent |
|---|---|---|---|---|---|
| `KolProceedsEvent` | proceeds | nom de table | 24 | oui | oui |
| `OsintSubmission` | piece | colonnes piece:imageSha256 piece:perceptualHash nominatif:submitter publication:trustTier nominatif:kolHandle | 11 | oui | **NON** |
| `KolProceedsSummary` | proceeds | nom de table | 7 | oui | oui |
| `wallet_sync_state` | nominatif | colonnes nominatif:walletAddress | 4 | **non** | **NON** |
| `CaseFileClaim` | dossier | nom de table | 3 | oui | oui |
| `Retraction` | nominatif | colonnes nominatif:kolHandle dossier:reason dossier:previousValue dossier:correctedValue nominatif:initiatedBy | 3 | oui | **NON** |
| `KolTokenLinkStatusLog` | nominatif | nom de table | 3 | oui | **NON** |
| `CaseFileSource` | dossier | nom de table | 2 | oui | oui |
| `OsintReviewAudit` | piece | colonnes piece:itemId nominatif:actor dossier:reason dossier:beforeJson dossier:afterJson | 2 | oui | **NON** |
| `ContradictionAlert` | nominatif | colonnes nominatif:kolHandle dossier:tweetText proceeds:sellAmountUsd | 1 | oui | **NON** |
| `SerialPattern` | nominatif | colonnes nominatif:deployerAddress nominatif:linkedKolHandles dossier:linkedCaseIds | 1 | oui | **NON** |

### Les 19 gouvernées PRÉSENTES au schéma, atteintes en SQL brut

Point aveugle plus profond que le précédent : la découverte suivait la FORME DE
L'ACCESSEUR (`prisma.<modèle>.`). Un fichier qui ne parle que SQL n'était pas
une racine, même sur un modèle parfaitement déclaré. Une seule de ces 19 était
à l'inventaire des racines brutes — `token_casefiles`. Les dix-huit autres n'y
figuraient pas.

| table | modèle ORM | classe | lectures |
|---|---|---|---|
| `KolProfile` | KolProfile | nominatif | 18 |
| `KolTokenLink` | KolTokenLink | nominatif | 12 |
| `EvidenceSnapshot` | EvidenceSnapshot | piece | 11 |
| `EvidenceItem` | EvidenceItem | piece | 10 |
| `KolWallet` | KolWallet | nominatif | 9 |
| `KolCase` | KolCase | dossier | 7 |
| `KolTokenInvolvement` | KolTokenInvolvement | nominatif | 6 |
| `EvidenceLink` | EvidenceLink | piece | 4 |
| `casefiles` | CaseFile | dossier | 3 |
| `KolPromotionMention` | KolPromotionMention | nominatif | 3 |
| `WatcherCampaign` | WatcherCampaign | nominatif | 3 |
| `KolCrossLink` | KolCrossLink | nominatif | 2 |
| `token_casefiles` | TokenCaseFile | dossier | 1 |
| `KolEvidence` | KolEvidence | piece | 1 |
| `VaultCase` | VaultCase | dossier | 1 |
| `VaultCaseNote` | VaultCaseNote | nominatif | 1 |
| `VaultCaseFile` | VaultCaseFile | dossier | 1 |
| `VaultWorkspace` | VaultWorkspace | nominatif | 1 |
| `EvidenceNegative` | EvidenceNegative | piece | 0 |

### Écartées, avec leur raison

| table | raison |
|---|---|
| `_livre` | `CREATE TEMP TABLE … ON COMMIT DROP` de `src/lib/intelligence/ingest.ts` ; ne porte que des `dedupKey` livrés, rien ne lui survit |
| `cex_labels` | étiquettes publiques d'exchanges (`address`, `name`) ; aucun sujet identifié — et absente de la production |
| `PriceCache` | donnée de marché (`symbol`, `dateOnly`, `priceUsd`) ; aucun sujet identifié |
| 22 autres | modèle ORM présent mais hors des quatre classes gouvernées de build12 : `social_post_candidates`, `influencers`, `TokenPriceTracker`, `intel_ingestion_batches`, `SignalIntake`, `signals`, `influencer_scores`, `onchain_events`, `intel_source_observations`, `VaultCaseShare`, `intel_canonical_entities`, `VaultAuditLog`, `ask_logs`, `XApiUsage`, `WalletFundingEdge`, `alert_deliveries`, `ShillBuyerObservation`, `social_posts`, `LaundryTrail`, `wallets`, `JobRunLog`, `CandidateStatusLog` |

### Les deux entrées mortes

`CaseFileShiller` et `CaseFileSmokingGun` figuraient à l'inventaire précédent.
**Ce ne sont pas des tables** : ce sont des types TypeScript déclarés dans
`src/lib/casefile/pdfGenerator.ts` (lignes 121 et 145). Aucune requête SQL du
dépôt ne les nomme. Une liste tenue à la main se trompe DANS LES DEUX SENS à la
fois — il lui manquait vingt-cinq racines et elle affirmait l'existence de deux
tables imaginaires. La garde S24 signale désormais toute entrée qu'aucun site ne
touche.
