-- FERMETURE DES 10 BATCHES ZOMBIES — généré par le reaper en DRY-RUN le 2026-08-21
-- ttl=900s · dryRun=true · reaped=0 (aucune écriture)
--
-- Chaque UPDATE est gardé par « AND status = 'running' » : rejouable sans risque,
-- sans effet si le batch a déjà été fermé (par le cron reaper, par exemple).
-- Aucune ligne n'est supprimée.
--
-- NOTE : une fois /api/cron/reaper DÉPLOYÉ, il ferme ces 10 lignes tout seul
-- au prochain passage 02:30 UTC, avec exactement ces statuts. Ce script reste
-- utile pour fermer AVANT le déploiement, ou pour vérifier ce qui sera écrit.

BEGIN;

-- ofac | démarré 2026-04-03T14:38:54.559Z | figé 3356.7 h
-- preuves d'écriture : observations_created=225 ; entities_created=225
-- recordsRemoved : UNKNOWN (perdu avec le run)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-04-03 14:43:54.559'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12084129s en ''running''. Écritures PROUVÉES (observations_created=225, entities_created=225) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: UNKNOWN (perdu avec le run).' WHERE id = 'cmnj0eg6d0000zyd9vjr7x1uk' AND status = 'running';

-- ofac | démarré 2026-04-03T14:41:10.987Z | figé 3356.7 h
-- preuves d'écriture : observations_created=372 ; entities_created=372
-- recordsRemoved : UNKNOWN (perdu avec le run)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-04-03 14:46:10.987'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12083992s en ''running''. Écritures PROUVÉES (observations_created=372, entities_created=372) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: UNKNOWN (perdu avec le run).' WHERE id = 'cmnj0hdk50000gylu842x6lew' AND status = 'running';

-- scamsniffer | démarré 2026-04-03T14:54:39.648Z | figé 3356.4 h
-- preuves d'écriture : observations_created=1000 ; entities_created=1000
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-04-03 14:59:39.648'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 12083184s en ''running''. Écritures PROUVÉES (observations_created=1000, entities_created=1000) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmnj0ypdn0000wfphh630rzan' AND status = 'running';

-- scamsniffer | démarré 2026-08-15T02:23:49.881Z | figé 153.0 h
-- preuves d'écriture : recordsFetched=235000 ; observations_created=6228 ; entities_created=6228
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-15 02:28:49.881'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 550633s en ''running''. Écritures PROUVÉES (recordsFetched=235000, observations_created=6228, entities_created=6228) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmstr5a4c0000jp04oz2v0cz6' AND status = 'running';

-- scamsniffer | démarré 2026-08-16T01:56:50.236Z | figé 129.4 h
-- preuves d'écriture : recordsFetched=260000 ; observations_created=148 ; entities_created=148
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-16 02:01:50.236'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 465853s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=148, entities_created=148) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmsv5mf2d0000k204v92kkk3e' AND status = 'running';

-- scamsniffer | démarré 2026-08-17T01:37:22.236Z | figé 105.7 h
-- preuves d'écriture : recordsFetched=245000 ; observations_created=84 ; entities_created=84
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-17 01:42:22.236'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 380621s en ''running''. Écritures PROUVÉES (recordsFetched=245000, observations_created=84, entities_created=84) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmswkd8h50000l7043o0su39m' AND status = 'running';

-- scamsniffer | démarré 2026-08-18T01:37:22.198Z | figé 81.7 h
-- preuves d'écriture : recordsFetched=260000 ; observations_created=204 ; entities_created=204
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-18 01:42:22.198'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 294221s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=204, entities_created=204) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmsxzt3510000jv04oexmt9vz' AND status = 'running';

-- scamsniffer | démarré 2026-08-19T01:37:22.518Z | figé 57.7 h
-- preuves d'écriture : recordsFetched=260000 ; observations_created=89 ; entities_created=89
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-19 01:42:22.518'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 207821s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=89, entities_created=89) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmszf8y3c0000jq040amaox3t' AND status = 'running';

-- scamsniffer | démarré 2026-08-20T02:23:32.201Z | figé 33.0 h
-- preuves d'écriture : recordsFetched=265000 ; observations_created=95 ; entities_created=95
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-20 02:28:32.201'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 118651s en ''running''. Écritures PROUVÉES (recordsFetched=265000, observations_created=95, entities_created=95) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmt0wc5ag0000l704696iliv2' AND status = 'running';

-- scamsniffer | démarré 2026-08-21T01:59:18.323Z | figé 9.4 h
-- preuves d'écriture : recordsFetched=260000 ; observations_created=112 ; entities_created=112
-- recordsRemoved : NON APPLICABLE (marquage stale jamais tenté)
UPDATE intel_ingestion_batches SET status = 'TIMED_OUT_WITH_WRITES', "completedAt" = '2026-08-21 02:04:18.323'::timestamp, "errorMessage" = 'Reaper: run tué hors fenêtre serverless (maxDuration=300s) après 33705s en ''running''. Écritures PROUVÉES (recordsFetched=260000, observations_created=112, entities_created=112) : le contenu a coulé, le bookkeeping est incomplet. Ingestion probablement TRONQUÉE — ce batch n''a jamais atteint sa finalisation. recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=10000 lignes).' WHERE id = 'cmt2awuom0000l5050xac3o59' AND status = 'running';

-- Vérification avant COMMIT : doit renvoyer 0 ligne 'running'.
SELECT status, count(*) FROM intel_ingestion_batches GROUP BY status ORDER BY status;

COMMIT;
