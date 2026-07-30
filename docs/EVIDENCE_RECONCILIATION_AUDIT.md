# Audit d'intégrité — EvidenceSnapshot → EvidenceItem (CC-OFFLINE-55, Phase 1)

Généré : 2026-07-30T14:52:53.685Z · Source : ep-square-band (read-only, aucune modification).

## Décomptes (951 EvidenceSnapshot)

| Cat. | Définition | Nombre |
|---|---|---|
| A | sha256 stocké + fichier présent + hash IDENTIQUE (migrable propre) | **925** |
| B | sha256 stocké + fichier présent + hash DIVERGENT (ANOMALIE) | **0** |
| C | pas de sha256 + fichier présent (hashable) | **0** |
| D | fichier absent (non migrable) | **26** |

Migrables (A + C) : **925** · Quarantaine (B) : **0** · Perdues (D) : **26**

## Catégorie B — ANOMALIES (hash divergent) — INTÉGRALES

_Aucune anomalie : tous les fichiers présents avec sha256 recoupent le hash recalculé._

## Catégorie D — fichiers absents (échantillon 20)

- cmnkpgdzh0000lvgtxrx4du0y — `(null)`
- cmnkpge120001lvgt1va1kjt6 — `(null)`
- cmnkpge260002lvgtpacn9tv8 — `(null)`
- cmnkpge330003lvgtoiea47l0 — `(null)`
- cmnkpge420004lvgt96v41moe — `(null)`
- cmnkpge510005lvgt02a8yhvc — `(null)`
- cmnkqofup000086tdkq00jyfz — `(null)`
- cmnkqofw5000186tdenv1k61c — `(null)`
- cmnkqofxa000286tdcqt9ae92 — `(null)`
- cmnkqofy5000386tdfnyght78 — `(null)`
- cmnkqofzx000486tdr00abbzo — `(null)`
- cmnkqog0w000586tdhm3efbib — `(null)`
- cmnkqog4d000686tdwcxyp6yw — `(null)`
- cmnkqog5p000786tdqnwzcyp2 — `(null)`
- cmnkqog6m000886td0h6ljza6 — `(null)`
- cmnkr32dq0000g7p40fc2mu7c — `(null)`
- cmnkr32hl0001g7p4rqlcyk8d — `(null)`
- cmnkr32ij0002g7p41cjh6i4r — `(null)`
- cmnkr32ji0003g7p4p9a4vp5e — `(null)`
- cmnkr32kh0004g7p46znegmhc — `(null)`
- … +6

## Catégorie C — sans sha256, fichier présent (échantillon 20)


> Rappel principe : un futur horodatage de ces pièces est **RÉTROACTIF** — le token TSA prouvera l'existence du hash à la date de stamping, PAS que la capture a eu lieu à observedAt (date déclarative).
