-- scanned=10 reaped=0 dryRun=true ttl=900s

-- ofac | started 2026-04-03T14:38:54.559Z | âge 3356.4 h
-- preuves: observations_created=225 ; entities_created=225
-- recordsRemoved: UNKNOWN (perdu avec le run)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-04-03T14:43:54.559Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12082955s en ''running''. Écritures PROUVÉES (observations_created=225, entities_created=225) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: UNKNOWN (perdu avec le run).' WHERE id = 'cmnj0eg6d0000zyd9vjr7x1uk' AND status = 'running';

-- ofac | started 2026-04-03T14:41:10.987Z | âge 3356.3 h
-- preuves: observations_created=372 ; entities_created=372
-- recordsRemoved: UNKNOWN (perdu avec le run)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-04-03T14:46:10.987Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12082819s en ''running''. Écritures PROUVÉES (observations_created=372, entities_created=372) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: UNKNOWN (perdu avec le run).' WHERE id = 'cmnj0hdk50000gylu842x6lew' AND status = 'running';

-- scamsniffer | started 2026-04-03T14:54:39.648Z | âge 3356.1 h
-- preuves: observations_created=1000 ; entities_created=1000
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-04-03T14:59:39.648Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12082010s en ''running''. Écritures PROUVÉES (observations_created=1000, entities_created=1000) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmnj0ypdn0000wfphh630rzan' AND status = 'running';

-- scamsniffer | started 2026-08-15T02:23:49.881Z | âge 152.6 h
-- preuves: recordsFetched=235000 ; observations_created=6228 ; entities_created=6228
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-15T02:28:49.881Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 549460s en ''running''. Écritures PROUVÉES (recordsFetched=235000, observations_created=6228, entities_created=6228) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmstr5a4c0000jp04oz2v0cz6' AND status = 'running';

-- scamsniffer | started 2026-08-16T01:56:50.236Z | âge 129.1 h
-- preuves: recordsFetched=260000 ; observations_created=148 ; entities_created=148
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-16T02:01:50.236Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 464680s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=148, entities_created=148) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmsv5mf2d0000k204v92kkk3e' AND status = 'running';

-- scamsniffer | started 2026-08-17T01:37:22.236Z | âge 105.4 h
-- preuves: recordsFetched=245000 ; observations_created=84 ; entities_created=84
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-17T01:42:22.236Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 379448s en ''running''. Écritures PROUVÉES (recordsFetched=245000, observations_created=84, entities_created=84) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmswkd8h50000l7043o0su39m' AND status = 'running';

-- scamsniffer | started 2026-08-18T01:37:22.198Z | âge 81.4 h
-- preuves: recordsFetched=260000 ; observations_created=204 ; entities_created=204
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-18T01:42:22.198Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 293048s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=204, entities_created=204) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmsxzt3510000jv04oexmt9vz' AND status = 'running';

-- scamsniffer | started 2026-08-19T01:37:22.518Z | âge 57.4 h
-- preuves: recordsFetched=260000 ; observations_created=89 ; entities_created=89
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-19T01:42:22.518Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 206648s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=89, entities_created=89) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmszf8y3c0000jq040amaox3t' AND status = 'running';

-- scamsniffer | started 2026-08-20T02:23:32.201Z | âge 32.6 h
-- preuves: recordsFetched=265000 ; observations_created=95 ; entities_created=95
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-20T02:28:32.201Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 117478s en ''running''. Écritures PROUVÉES (recordsFetched=265000, observations_created=95, entities_created=95) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmt0wc5ag0000l704696iliv2' AND status = 'running';

-- scamsniffer | started 2026-08-21T01:59:18.323Z | âge 9.0 h
-- preuves: recordsFetched=260000 ; observations_created=112 ; entities_created=112
-- recordsRemoved: NON APPLICABLE (jamais calculé)
UPDATE intel_ingestion_batches SET status = 'timed_out_with_writes', "completedAt" = '2026-08-21T02:04:18.323Z'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 32532s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=112, entities_created=112) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmt2awuom0000l5050xac3o59' AND status = 'running';

### TABLEAU
┌─────────┬────────────────┬───────────────┬────────────────────┬──────────┬───────────────┬─────────┬─────────┬─────────┬───────────┐
│ (index) │ id             │ source        │ started            │ age_h    │ statut        │ fetched │ ent_new │ obs_new │ rm        │
├─────────┼────────────────┼───────────────┼────────────────────┼──────────┼───────────────┼─────────┼─────────┼─────────┼───────────┤
│ 0       │ 'cmnj0eg6d000' │ 'ofac'        │ '2026-04-03T14:38' │ '3356.4' │ 'with_writes' │ null    │ 225     │ 225     │ 'UNKNOWN' │
│ 1       │ 'cmnj0hdk5000' │ 'ofac'        │ '2026-04-03T14:41' │ '3356.3' │ 'with_writes' │ null    │ 372     │ 372     │ 'UNKNOWN' │
│ 2       │ 'cmnj0ypdn000' │ 'scamsniffer' │ '2026-04-03T14:54' │ '3356.1' │ 'with_writes' │ null    │ 1000    │ 1000    │ 'N/A'     │
│ 3       │ 'cmstr5a4c000' │ 'scamsniffer' │ '2026-08-15T02:23' │ '152.6'  │ 'with_writes' │ 235000  │ 6228    │ 6228    │ 'N/A'     │
│ 4       │ 'cmsv5mf2d000' │ 'scamsniffer' │ '2026-08-16T01:56' │ '129.1'  │ 'with_writes' │ 260000  │ 148     │ 148     │ 'N/A'     │
│ 5       │ 'cmswkd8h5000' │ 'scamsniffer' │ '2026-08-17T01:37' │ '105.4'  │ 'with_writes' │ 245000  │ 84      │ 84      │ 'N/A'     │
│ 6       │ 'cmsxzt351000' │ 'scamsniffer' │ '2026-08-18T01:37' │ '81.4'   │ 'with_writes' │ 260000  │ 204     │ 204     │ 'N/A'     │
│ 7       │ 'cmszf8y3c000' │ 'scamsniffer' │ '2026-08-19T01:37' │ '57.4'   │ 'with_writes' │ 260000  │ 89      │ 89      │ 'N/A'     │
│ 8       │ 'cmt0wc5ag000' │ 'scamsniffer' │ '2026-08-20T02:23' │ '32.6'   │ 'with_writes' │ 265000  │ 95      │ 95      │ 'N/A'     │
│ 9       │ 'cmt2awuom000' │ 'scamsniffer' │ '2026-08-21T01:59' │ '9.0'    │ 'with_writes' │ 260000  │ 112     │ 112     │ 'N/A'     │
└─────────┴────────────────┴───────────────┴────────────────────┴──────────┴───────────────┴─────────┴─────────┴─────────┴───────────┘
