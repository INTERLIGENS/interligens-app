# Audit Technique — Investigator Room (Vault)
**INTERLIGENS — docs/audits/investigator-room-audit-2026-04-20.md**
Rédigé le 2026-05-02. Mode lecture seule. Aucune modification de code.

---

## 1. Résumé exécutif

### État réel de l'Investigator Room

L'Investigator Room — appelée « Vault » dans le code — est une **plateforme d'investigation chiffrée de bout en bout**, complète et opérationnelle en production. Elle comprend un workspace chiffré (AES-256-GCM côté client, KDF PBKDF2-SHA256 310k itérations), la gestion de cas, d'entités, de fichiers (R2), de notes, d'hypothèses, d'événements de timeline, de graphes réseau, et un assistant IA Claude Sonnet 4 pleinement intégré.

Ce n'est pas une maquette. C'est un système mature qui tourne en production.

### Niveau de maturité

| Domaine | Maturité |
|---|---|
| Infrastructure Vault (auth, sessions, audit) | PRODUCTION |
| Case management (CRUD chiffré) | PRODUCTION |
| File storage R2 (upload/download) | PRODUCTION |
| Entités + enrichissement TigerScore | PRODUCTION |
| Assistant IA (CaseIntelligencePack) | PRODUCTION |
| Timeline Builder (manuel) | BETA — FONCTIONNEL |
| Export JSON casefile | BETA — FONCTIONNEL |
| Security Dashboard admin | PRODUCTION |
| Evidence Snapshot (modèle + route lecture) | PARTIEL — modèle OK, écriture Vault absente |
| IOC Export (CSV/STIX/police) | ABSENT — JSON seulement |
| Tool Dock (intégration outils externes) | ABSENT — scripts de seed seulement |
| Entity Resolution cross-case | PARTIEL — collision detection, KolCrossLink en raw SQL non migré |
| Victim Intake → VaultCase | ABSENT — deux systèmes déconnectés |

### Ce qui est solide

- **133 modèles Prisma** couvrant la totalité du domaine métier.
- **Vault 100% chiffré côté client** — le serveur ne voit jamais le contenu des notes, titres, fichiers.
- **Assistant IA de qualité investigateur** : `buildCaseIntelligencePack`, FACTS/INFERENCES/GAPS/NEXT STEPS/PUBLICATION CAUTION, scoring confiance, contradictions, corrélation temporelle.
- **Système de scoring déterministe** (TigerScore, versioned, 1141+ tests).
- **Security Dashboard** complet avec vendor monitoring, incidents, digest hebdomadaire, cron.
- **Programme investigateur** complet (application, NDA, KYC, audit trail typé, niveaux de confiance).

### Ce qui est incomplet

- **Tool Dock** : absent dans l'UI Vault. Les outils externes (Arkham, MetaSleuth, Chainabuse, GoPlus, ScamSniffer) existent en `lib/` ou scripts de seed — mais aucun panneau dédié dans le Room.
- **Evidence Snapshot** : modèle `EvidenceSnapshot` (ligne 1142 du schema) + route `GET /api/evidence/snapshots` existent. Mais aucun formulaire "Add Evidence" dans le Vault, aucune route POST de création depuis le Vault, pas de statut PRIVATE/SHAREABLE/PUBLISHABLE dans le contexte casefile.
- **IOC Export** : `CaseExport.tsx` (920 lignes) exporte uniquement en JSON. Pas de format CSV, STIX, annexe police.
- **Entity Resolution cross-case** : `crossCaseLinker.ts` (168 lignes) fonctionne en lecture mais écrit dans `KolCrossLink` via raw SQL — table absente du schema Prisma. Le fichier documente lui-même ce problème : *"table not yet in Prisma schema"*.
- **Victim Intake → Vault** : `IntakeRecord` et pipeline admin complets, mais aucun lien vers `VaultCase`. Les victimes restent dans un silo admin non accessible aux investigateurs.

### Meilleur gros chantier recommandé

**Chantier B — Evidence Snapshot System intégré au Vault**

Priorité maximale. Socle déjà posé (modèle, route GET). Risque bêta minimal (additif pur). Valeur immédiate pour les investigateurs. Déblocage de la chaîne de preuve. Détail au §6.B.

---

## 2. Cartographie actuelle

| Feature | Fichiers / Routes trouvés | État | Commentaire technique |
|---|---|---|---|
| Vault workspace (auth + session) | `src/lib/vault/auth.server.ts`, `src/lib/security/investigatorAuth.ts`, `InvestigatorAccess`, `InvestigatorSession` | DONE | Cookie httpOnly 8h, SHA-256, audit log complet |
| Case CRUD chiffré | `app/api/investigators/cases/`, `VaultCase`, `VaultWorkspace` | DONE | 5 templates (blank, rug-pull, kol-promo, cex-cashout, infostealer) |
| Entity management + enrichissement | `app/api/investigators/cases/[caseId]/entities/`, `VaultCaseEntity` | DONE | TigerScore + tigerVerdict stockés, enrichissement IA |
| File upload / R2 | `app/api/investigators/cases/[caseId]/files/`, `src/lib/vault/r2-vault.ts`, `VaultCaseFile` | DONE | Presign PUT 5min, GET 15min, filenameEnc/IV |
| Notes chiffrées | `app/api/investigators/cases/[caseId]/notes/` | DONE | contentEnc/contentIv |
| Hypothèses | `app/api/investigators/cases/[caseId]/hypotheses/` | DONE | Status OPEN/CONFIRMED/REFUTED/NEEDS_VERIFICATION, score confiance |
| Timeline Builder (manuel) | `src/components/vault/TimelineBuilder.tsx` (350 lignes), `app/api/.../timeline-events/` | PARTIAL | Ajout/suppression manuel d'événements, lien entités. Pas d'auto-génération. |
| Timeline automatique scan | `app/api/scan/timeline/[address]`, `app/api/scan/timeline/auto` | DONE | Séparé du Vault — timeline publique adresse/token |
| Graphe réseau chiffré | `VaultNetworkGraph`, `app/investigators/box/network/`, `CaseGraphPremium.tsx` | DONE | payloadEnc/IV, share fonctionnel |
| Share tokens | `app/api/.../share/`, `VaultCaseShare` | DONE | Expiry, snapshot entités/hypothèses |
| Publish candidate | `app/api/.../publish-candidate/`, `VaultPublishCandidate` | DONE | Status PENDING/reviewed |
| Assistant IA (chat) | `app/api/.../assistant/route.ts`, `src/lib/vault/buildCaseIntelligencePack.ts` | DONE | Claude Sonnet 4, CaseIntelligencePack, FACTS/INFERENCES/GAPS |
| AI Summary | `app/api/.../ai-summary/route.ts` | DONE | Retail summary + investigator summary, mock si ANTHROPIC_API_KEY absent |
| Intelligence Summary | `app/api/.../intelligence-summary/route.ts` | DONE | |
| Export JSON casefile | `src/components/vault/CaseExport.tsx` (920 lignes) | DONE | JSON scrubbing des champs sensibles, privacy audit |
| Export CSV / STIX / police | — | MISSING | Non implémenté |
| Tool Dock UI | — | MISSING | Inexistant dans le Vault |
| Evidence Snapshot (modèle) | `EvidenceSnapshot` schema ligne 1142, `GET /api/evidence/snapshots` | PARTIAL | Lecture seule, pas de POST depuis Vault |
| Evidence Snapshot (Vault write) | — | MISSING | Aucun formulaire "Add Evidence" dans case workspace |
| Entity collision detection | `app/api/investigators/entities/collisions/route.ts` (51 lignes) | PARTIAL | Compte les collisions cross-workspace, pas de résolution |
| Entity Resolution cross-case | `src/lib/intelligence/crossCaseLinker.ts` (168 lignes) | PARTIAL | Logique OK, table `KolCrossLink` absente du schema Prisma |
| Victim Intake pipeline | `src/lib/intake/`, `IntakeRecord`, `app/admin/intake/`, `/en/victim/report/` | DONE (admin) | Complet côté admin. Lien vers VaultCase absent. |
| IOC Export (formats) | — | MISSING | Aucun format IOC structuré |
| Security Dashboard | `app/admin/security/page.tsx`, `src/lib/security/queries.ts`, 8 routes admin | DONE | Full vendor monitoring, incidents, digest cron |
| Audit logs Vault | `VaultAuditLog`, toutes routes → `logAudit()` | DONE | Action, actor, IP (hashé), userAgent, metadata JSON |

---

## 3. Modèle de données actuel

### Tables existantes (périmètre Investigator Room)

**Authentification et accès :**
- `InvestigatorAccess` (702) — codes SHA-256, labels, expiry
- `InvestigatorSession` (722) — tokens opaques, TTL 8h
- `InvestigatorAuditLog` (739) — login/logout/fail, IP hashée
- `InvestigatorProfile` (1764) — KYC, niveau accès, statut
- `InvestigatorApplication` (1812) — formulaire public
- `InvestigatorNdaAcceptance`, `InvestigatorBetaTermsAcceptance` — signatures NDA/CGU
- `InvestigatorProgramAuditLog` (1865) — 13 événements typés

**Vault Workspace (cœur) :**
- `VaultProfile` — handle, badges, spécialités, visibilité
- `VaultWorkspace` — KDF salt, AES-256-GCM, token budget assistant
- `VaultCase` (1455) — titleEnc/IV, tagsEnc/IV, statut PRIVATE|SHARED_INTERNAL|SUBMITTED|ARCHIVED
- `VaultCaseEntity` (1559) — type (WALLET|TX_HASH|HANDLE|URL|DOMAIN|ALIAS|EMAIL|IP|CONTRACT|OTHER), tigerScore, tigerVerdict
- `VaultCaseFile` (1579) — filenameEnc/IV, r2Key, parseStatus
- `VaultCaseNote` (1599) — contentEnc/contentIv
- `VaultCaseTimeline` (1611) — event log (eventType, actor, payload)
- `VaultTimelineEvent` — events manuels (date, description, entityIds)
- `VaultHypothesis` — status, confidence, linked entities
- `VaultCaseShare` — share token, expiry, snapshot
- `VaultPublishCandidate` — soumission publication
- `VaultAuditLog` (1623) — audit trail workspace complet
- `VaultNetworkGraph` (2074) — payloadEnc/IV, nodeCount, edgeCount
- `VaultInvite`, `VaultNdaAcceptance`

**Intelligence et preuves :**
- `EvidenceSnapshot` (1142) — relationType, snapshotType, imageUrl, title, caption, sourceLabel, isPublic, reviewStatus
- `ArchivedEvidence` (1019) — platform, captureType, evidenceType, analyst archive
- `CanonicalEntity` (838) — dedupKey SHA-256, riskClass, displaySafety
- `SourceObservation` (885) — sourceSlug (ofac/amf/fca/scamsniffer/goplus…), jurisdiction, removedAt

**Admin/intake :**
- `IntakeRecord` — inputType, status, extractedWallets, extractedHandles, linkedBatchId
- `CaseFile` (602) — PDF generation, pdfSha256, storageKey
- `AskLog` (1204) — audit trail LLM complet

**Sécurité :**
- `SecurityVendor`, `SecuritySource`, `SecurityIncident`, `SecurityExposureAssessment`, `SecurityAsset`, `SecurityAuditLog`, `SecurityThreatCatalog`, `SecurityCommsDraft`, `SecurityWeeklyDigest`

### Tables manquantes (pour les chantiers A–F)

| Table | Chantier | Priorité | Description |
|---|---|---|---|
| `VaultEvidenceSnapshot` | B | HAUTE | Evidence attachée à un VaultCase : url, title, sourceType, note, tags, entityId, status (PRIVATE/SHAREABLE/PUBLISHABLE/REDACTED), sha256, r2Key screenshot, publishedAt |
| `KolCrossLink` | D | MOYENNE | Liens cross-KOL détectés par crossCaseLinker.ts — absent du schema, raw SQL actuel |
| `VaultEntityLink` | D | MOYENNE | Liens entre entités cross-case avec type, confiance, source |
| `VaultVictimStatement` | E | MOYENNE | Lien IntakeRecord → VaultCase avec statut, anonymisation, consentement |
| `VaultToolBookmark` | A-V2 | BASSE | Bookmarks d'outils externes avec BYO key encrypted |

### Champs manquants sur tables existantes

| Table | Champ manquant | Utilité |
|---|---|---|
| `VaultCaseEntity` | `publishabilityStatus` | Nécessaire pour IOC Export filtré |
| `VaultCaseEntity` | `firstSeen`, `lastSeen` | Nécessaire pour IOC Export STIX |
| `VaultTimelineEvent` | `source` (manual/auto/scan/evidence) | Distinguer les origines |
| `VaultTimelineEvent` | `confidence` | Confiance de l'événement |
| `IntakeRecord` | `linkedVaultCaseId` | Lien victim intake → case |
| `EvidenceSnapshot` | `sha256Hash` | Hash de contenu pour la piste d'audit |

### Risques migration Prisma

- **Règle absolue** : schema additif uniquement. `prisma/schema.prod.prisma`. Jamais de `prisma db push`. Migrations via Neon SQL Editor.
- Toutes les tables listées ci-dessus sont des **ajouts purs** — aucune modification de table existante requise pour les chantiers B (minimal), F (minimal), D (minimal).
- La correction de `KolCrossLink` (D) nécessite d'ajouter la table au schema ET de migrer le raw SQL vers Prisma ORM.

---

## 4. Routes / API actuelles

### Investigateur Vault (48 routes)

| Endpoint | Rôle | État | Risque | Besoin futur |
|---|---|---|---|---|
| `GET/POST /api/investigators/cases` | Liste + création de cas | DONE | — | — |
| `GET/PUT/DELETE /api/investigators/cases/[caseId]` | CRUD cas | DONE | — | — |
| `GET/POST /api/investigators/cases/[caseId]/entities` | Entités | DONE | — | Champ publishabilityStatus |
| `POST /api/investigators/cases/[caseId]/entities/enrich` | Enrichissement IA | DONE | Rate limit | — |
| `GET/POST /api/investigators/cases/[caseId]/files` | Fichiers R2 | DONE | — | — |
| `POST /api/investigators/cases/[caseId]/files/[id]/presign` | Upload signé | DONE | 5min TTL | — |
| `GET/POST /api/investigators/cases/[caseId]/timeline-events` | Timeline manuelle | DONE | — | Auto-feed scan |
| `POST /api/investigators/cases/[caseId]/assistant` | Chat IA | DONE | Budget tokens | — |
| `POST /api/investigators/cases/[caseId]/ai-summary` | Résumé IA | DONE | Fallback mock si no key | — |
| `POST /api/investigators/cases/[caseId]/publish-candidate` | Soumission publication | DONE | — | — |
| `GET /api/investigators/entities/collisions` | Collisions cross-workspace | PARTIAL | — | Résolution + liens |
| `POST /api/investigators/entities/search` | Recherche entités | DONE | — | — |
| `GET /api/evidence/snapshots` | Snapshots (lecture) | PARTIAL | — | POST création depuis Vault |

### Routes manquantes pour les chantiers

| Route à créer | Chantier | Méthode | Description |
|---|---|---|---|
| `/api/investigators/cases/[caseId]/evidence` | B | GET/POST | Liste + création d'evidence snapshots dans un cas |
| `/api/investigators/cases/[caseId]/evidence/[id]` | B | GET/PUT/DELETE | CRUD snapshot individuel |
| `/api/investigators/cases/[caseId]/evidence/[id]/screenshot` | B | POST | Upload screenshot R2 |
| `/api/investigators/cases/[caseId]/timeline/export` | C | GET | Export chronologie JSON/PDF police |
| `/api/investigators/cases/[caseId]/export/ioc` | F | GET | Export IOC CSV/JSON/STIX |
| `/api/investigators/cases/[caseId]/export/police` | F | GET | Annexe police FR |
| `/api/investigators/cases/[caseId]/intelligence-gaps` | G | POST | Analyse lacunes IA |
| `/api/admin/intake/[id]/link-case` | E | POST | Lier un IntakeRecord à un VaultCase |

---

## 5. UI actuelle — Investigator Room

### Pages existantes

```
/investigators/                          Landing programme
/investigators/apply/                    Formulaire candidature
/investigators/onboarding/welcome/       Bienvenue
/investigators/onboarding/legal/         NDA + CGU
/investigators/onboarding/identity/      KYC
/investigators/box/                      Dashboard principal
/investigators/box/cases/                Liste des cas
/investigators/box/cases/[caseId]/       Workspace cas (page centrale)
/investigators/box/cases/[caseId]/shill-timeline/  Timeline shill spécifique
/investigators/box/cases/[caseId]/print/ Vue impression
/investigators/box/graph/                Graphes réseau
/investigators/box/graphs/[id]/          Graphe individuel
/investigators/box/network/              Network graph
/investigators/box/messages/             Messagerie
/investigators/box/redact/               Outil de rédaction
/investigators/box/trust/                Programme de confiance
```

### Composants vault/ existants (19 fichiers)

| Composant | Taille | État | Description |
|---|---|---|---|
| `CaseAssistant.tsx` | — | DONE | Chat IA avec historique messages |
| `CaseExport.tsx` | 920 lignes | DONE (JSON) | Export JSON + print + retail summary + publish candidate. Format IOC absent. |
| `CaseGraphPremium.tsx` | — | DONE | Visualisation réseau chiffrée |
| `CaseTwin.tsx` | — | DONE | Comparaison de cas, reuse d'entités |
| `EntityAddForm.tsx` | — | DONE | Ajout d'entité dans un cas |
| `EntityLaunchpad.tsx` | — | DONE | Discovery d'entités |
| `EntitySuggestionPanel.tsx` | — | DONE | Suggestions IA d'entités |
| `TimelineBuilder.tsx` | 350 lignes | PARTIAL | Ajout/suppression événements manuels. Pas d'auto-feed. Pas d'export. |
| `ShareCaseModal.tsx` | — | DONE | Modal partage avec token |
| `WalletJourney.tsx` | — | DONE | Visualisation flow wallet |
| `NotesToolbar.tsx` | — | DONE | Éditeur notes chiffré |
| `SavedGraphsSection.tsx` | — | DONE | Gestion graphes sauvegardés |
| `VaultGate.tsx` | — | DONE | Contrôle d'accès |
| `NextBestStepToast.tsx` | — | DONE | Guidance workflow |
| `FeedbackButton.tsx` | — | DONE | Feedback utilisateur |
| `IntelVaultBadge.tsx` | — | DONE | Badge intel vault |
| `WatermarkOverlay.tsx` | — | DONE | Watermark sur exports |
| `VaultToast.tsx` | — | DONE | Notifications |

### Intégration possible Tool Dock

Le workspace cas `investigators/box/cases/[caseId]/page.tsx` est la page centrale. Un panneau latéral rétractable "Tool Dock" serait naturel comme section additionnelle — aucune refonte requise. Les entités VaultCaseEntity fournissent déjà les données (type + value) pour construire les deep links dynamiquement.

**Intégration V1 (read-only deep links) :** ~3 fichiers nouveaux, 0 migration DB.

### Intégration possible Evidence Snapshot

Le composant `CaseExport.tsx` a déjà la structure UI (sections, boutons, états). Un panneau "Evidence" adjacent dans le workspace cas peut réutiliser les patterns existants. La route `GET /api/evidence/snapshots` + une route POST à créer suffisent pour le MVP.

**Intégration V1 :** ~4 fichiers (1 composant, 2 routes, 1 table), 1 migration additive.

### Intégration possible Timeline

`TimelineBuilder.tsx` (350 lignes) est entièrement fonctionnel pour le manuel. L'auto-génération depuis les scan results et les entités du cas est la pièce manquante. L'export "police chronology" est une route + template PDF additive.

---

## 6. Gap analysis par chantier (A à H)

---

### A. Tool Dock — Intégration outils externes

**État actuel**

Les outils sont présents dans le code sous forme de clients API ou scripts de seed :
- `src/lib/chains/chainabuse.ts` — client Chainabuse
- `src/lib/surveillance/etherscan/client.ts` — client Etherscan
- `src/lib/mm/data/etherscan.ts`, `src/lib/mm/data/helius.ts` — Etherscan, Helius
- `src/lib/intelligence/sources/goplus.ts`, `src/lib/intelligence/sources/scamsniffer.ts` — GoPlus, ScamSniffer
- `src/scripts/seed/metasleuthEnrich.ts`, `src/scripts/seed/phase6hArkhamWallets.ts` — MetaSleuth, Arkham (scripts seed manuels)
- `src/lib/rpc.ts` — Helius RPC

**Aucun Tool Dock UI n'existe dans le Vault.** Les outils sont des services internes, pas des panneaux accessibles aux investigateurs.

**Manque exact**
- Composant `ToolDock.tsx` dans le workspace cas
- Deep links dynamiques depuis les entités VaultCaseEntity (type + value → URL externe)
- V1 : 12 outils avec deep links (Arkham, Etherscan, Solscan, Dune, Chainabuse, GoPlus, ScamSniffer, Helius, MetaSleuth, Breadcrumbs, Bitquery, STIX/OpenCTI)

**Complexité :** LOW (V1 deep links) → HIGH (V2 BYO keys + snapshots)
**Risque bêta :** LOW — purement additif, aucune modification des routes existantes
**Dépendances :** VaultCaseEntity (existant), UI workspace cas (existant)
**Ordre recommandé :** 3ème (après B et F)

**Fichiers à créer :** `src/components/vault/ToolDock.tsx`
**Tables à ajouter :** Aucune pour V1. `VaultToolBookmark` pour V2.
**Routes à ajouter :** Aucune pour V1.

---

### B. Evidence Snapshot System

**État actuel**

- `EvidenceSnapshot` (schema ligne 1142) : modèle existant avec relationType, snapshotType, imageUrl, title, caption, sourceLabel, isPublic, reviewStatus.
- `GET /api/evidence/snapshots` (20 lignes) : lecture uniquement, par relationType/relationKey.
- `src/lib/evidence/evidenceSnapshots.ts` : fonctions de lecture.
- `src/lib/evidence/builder.ts` + `builder.test.ts` : builder d'evidence existant.
- `src/components/case/CaseSnapshot.tsx` : composant d'affichage snapshot (public).

**Ce qui manque :** Le modèle EvidenceSnapshot est conçu pour le **profil public** (KOL, dossier). Il n'est **pas connecté au Vault**. Il n'y a pas de :
- Route POST depuis le Vault pour créer une preuve liée à un VaultCase
- Statut PRIVATE/SHAREABLE/PUBLISHABLE/REDACTED (non présent dans EvidenceSnapshot)
- Hash SHA-256 du contenu
- Upload screenshot vers R2 depuis le Vault
- Formulaire "Add Evidence" dans le workspace cas

**La solution recommandée** est d'ajouter une table `VaultEvidenceSnapshot` dédiée au Vault (séparée du modèle public `EvidenceSnapshot`) avec les champs du cahier des charges.

**Manque exact**
- Modèle `VaultEvidenceSnapshot` dans le schema
- 3 routes (GET, POST, DELETE) sous `.../cases/[caseId]/evidence/`
- Route upload screenshot R2 (réutilise `r2-vault.ts`)
- Composant `EvidencePanel.tsx` dans workspace cas
- Audit log pour chaque snapshot (réutilise `logAudit()`)

**Complexité :** MEDIUM
**Risque bêta :** LOW — additif pur, aucune modification de route existante
**Dépendances :** VaultCase (existant), R2 (existant), auth.server.ts (existant)
**Ordre recommandé :** 1er — meilleur ratio valeur/risque

**Fichiers à modifier :** `prisma/schema.prod.prisma` (+1 table)
**Fichiers à créer :** `app/api/investigators/cases/[caseId]/evidence/route.ts`, `app/api/investigators/cases/[caseId]/evidence/[id]/route.ts`, `app/api/investigators/cases/[caseId]/evidence/[id]/screenshot/route.ts`, `src/components/vault/EvidencePanel.tsx`
**Tests à ajouter :** Route POST/GET (Vitest), upload mock R2

---

### C. Case Timeline Builder

**État actuel**

- `TimelineBuilder.tsx` (350 lignes) : **fonctionnel**. Ajout/suppression d'événements manuels, titre, date, description, entités liées.
- `GET/POST /api/investigators/cases/[caseId]/timeline-events` : routes implémentées.
- `GET/PUT/DELETE /api/investigators/cases/[caseId]/timeline-events/[eventId]` : routes implémentées.
- `GET /api/investigators/cases/[caseId]/timeline` : vue complète timeline.
- `VaultCaseTimeline` + `VaultTimelineEvent` : deux modèles — VaultCaseTimeline est un event log système, VaultTimelineEvent est pour les événements manuels investigateur.
- `src/lib/shill-to-exit/timeline.ts` + `timeline.test.ts` : timeline de shill séparée.
- `app/api/scan/timeline/auto` : auto-timeline publique (scan d'adresse), complètement séparée du Vault.

**Ce qui manque :**
- Auto-génération depuis les entités du cas (wallet deployer → date déploiement, etc.)
- Lien entre les scan results publics et la timeline Vault d'un cas
- Export "chronologie police" (PDF/JSON structuré)
- Filtre on-chain/off-chain/social/investigateur dans l'UI
- Champs `source` et `confidence` sur `VaultTimelineEvent`

**Complexité :** MEDIUM (auto-feed) → HIGH (export police, narrative EN/FR)
**Risque bêta :** LOW pour les champs manquants, MEDIUM pour l'auto-feed (dépend des scan APIs)
**Dépendances :** VaultCaseEntity (existant), scan APIs (existant), PDF engine (existant)
**Ordre recommandé :** 4ème

**Fichiers à modifier :** `prisma/schema.prod.prisma` (champs `source`, `confidence` sur VaultTimelineEvent), `TimelineBuilder.tsx`
**Routes à ajouter :** `/api/investigators/cases/[caseId]/timeline/export`
**Tables à modifier :** Ajout champs `source` et `confidence` sur `VaultTimelineEvent`

---

### D. Entity Resolution Layer

**État actuel**

- `app/api/investigators/entities/collisions/route.ts` (51 lignes) : détecte les collisions cross-workspace (même valeur d'entité dans d'autres workspaces). Read-only. Retourne `hasCollisions` + `collisionCount`. Aucune résolution.
- `src/lib/intelligence/crossCaseLinker.ts` (168 lignes) : trouve les liens cross-KOL (shared_wallet, shared_deployer, shared_token, shared_cex_deposit). Logique complète. **Problème critique : écrit dans `KolCrossLink` via `$queryRaw` — table absente du schema Prisma.**
- `src/components/vault/CaseTwin.tsx` : comparaison de cas, réutilisation d'entités.
- `CanonicalEntity` + `SourceObservation` : dédup dans le module intelligence admin — non connecté au Vault.

**Ce qui manque :**
- Table `KolCrossLink` dans le schema Prisma (bloque `crossCaseLinker.ts`)
- Interface de résolution dans le Vault (voir les collisions, décider de les lier)
- Table `VaultEntityLink` pour stocker les liens confirmés avec type/confiance/source
- Normalisation des valeurs d'entités (wallets en minuscules, handles sans @, domaines sans http)

**Complexité :** MEDIUM
**Risque bêta :** LOW — additif
**Dépendances :** VaultCaseEntity (existant), crossCaseLinker.ts (existant mais bloqué)
**Ordre recommandé :** 2ème (débloque crossCaseLinker qui est en prod mais en raw SQL)

**Fichiers à modifier :** `prisma/schema.prod.prisma` (+2 tables : `KolCrossLink`, `VaultEntityLink`), `crossCaseLinker.ts` (migrer de raw SQL vers Prisma)
**Tests à ajouter :** crossCaseLinker unit tests

---

### E. Victim Intake (privé, Investigator Room)

**État actuel**

- `IntakeRecord` : modèle complet. `inputType`, `status`, `extractedWallets`, `extractedHandles`, `linkedBatchId`.
- `src/lib/intake/` : pipeline complet — `extract.ts`, `router.ts`, `trustScore.ts`, `corroboration.ts`.
- `app/admin/intake/` : UI admin complète (page liste, page détail, new record).
- `app/api/admin/intake/` : routes admin complètes.
- `/en/victim/report/` et `/fr/victim/report/` : formulaires publics.
- `src/lib/intake/__tests__/router.test.ts` : tests du routeur.

**Ce qui manque :**
- Champ `linkedVaultCaseId` sur `IntakeRecord`
- Route `POST /api/admin/intake/[id]/link-case` pour lier un intake à un VaultCase
- Modèle `VaultVictimStatement` pour stocker la déclaration dans le contexte Vault (avec anonymisation, consentement, statut)
- Feature flag recommandé : accès investigateurs au module intake (actuellement admin-only)
- Pas de formulaire "Victim Report" dans le Vault — les investigateurs ne peuvent pas recevoir de signalements directement

**Complexité :** MEDIUM
**Risque bêta :** MEDIUM (données sensibles, GDPR, prudence juridique)
**Dépendances :** IntakeRecord (existant), VaultCase (existant), programme investigateur (existant)
**Ordre recommandé :** 5ème — après les fondations (B, D)

**Fichiers à modifier :** `prisma/schema.prod.prisma` (champ `linkedVaultCaseId` sur IntakeRecord, +1 table VaultVictimStatement)
**Routes à ajouter :** `/api/admin/intake/[id]/link-case`
**Note légale :** Toujours derrière feature flag. Anonymisation obligatoire. Audit log de chaque accès.

---

### F. IOC / Threat Intel Export Center

**État actuel**

- `src/components/vault/CaseExport.tsx` (920 lignes) : **très complet pour le JSON**. Export JSON avec scrubbing des champs sensibles, privacy audit en console, retail summary IA, publish candidate workflow. Contient une variable `retailMock` indiquant qu'une partie de la fonctionnalité est simulée sans API key.
- `app/investigators/box/cases/[caseId]/print/page.tsx` : vue impression casefile.
- `src/lib/casefile/pdfGeneratorPublic.ts` : générateur PDF public.
- `src/lib/pdf/v2/templateV2.ts`, `src/lib/pdf/kol/templateKol.ts` : templates PDF existants.
- `src/lib/surveillance/reports/generateCaseFile.ts` : génération casefile.
- `app/api/casefile/pdf` : route PDF existante.

**Ce qui manque :**
- Format CSV IOC (wallets, contracts, tx hashes, domains, handles)
- Format JSON STIX-like avec firstSeen/lastSeen/confidence/chain
- Annexe police FR (format Word ou PDF structuré avec numérotation)
- Annexe cyber threat intel (format ISACs)
- Route `/api/investigators/cases/[caseId]/export/ioc`
- Champs `publishabilityStatus`, `firstSeen`, `lastSeen` sur `VaultCaseEntity`

**Complexité :** MEDIUM (CSV/JSON STIX) → HIGH (annexe police officielle)
**Risque bêta :** LOW — exports sont additifs, aucune modification de données
**Dépendances :** VaultCaseEntity (existant), CaseExport.tsx (existant), PDF templates (existant)
**Ordre recommandé :** 2ème ou 3ème (débloque immédiatement la valeur pour les enquêteurs)

**Fichiers à modifier :** `src/components/vault/CaseExport.tsx` (ajouter boutons CSV/STIX), `prisma/schema.prod.prisma` (champs VaultCaseEntity)
**Routes à ajouter :** `/api/investigators/cases/[caseId]/export/ioc`
**Templates à créer :** `src/lib/vault/export/iocCsv.ts`, `src/lib/vault/export/stixJson.ts`, `src/lib/vault/export/policeAnnex.ts`

---

### G. Internal Investigation Assistant (Claude-ready layer)

**État actuel**

C'est le chantier **le plus avancé**. L'assistant est en production :

- `app/api/investigators/cases/[caseId]/assistant/route.ts` : chat IA multi-tour, system prompt investigateur de qualité, `buildCaseIntelligencePack`, FACTS/INFERENCES/GAPS/NEXT STEPS/PUBLICATION CAUTION.
- `src/lib/vault/buildCaseIntelligencePack.ts` : pack d'intelligence structuré (entities, hypotheses, timeline, network, proceeds, laundry trail, confidence assessment, contradictions, timeline correlation).
- `app/api/investigators/cases/[caseId]/ai-summary/route.ts` : résumé retail + résumé investigateur, mock fallback.
- `app/api/investigators/cases/[caseId]/intelligence-summary/route.ts` : résumé intelligence.
- `AskLog` (ligne 1204) : audit trail de tous les appels LLM.
- Model Claude Sonnet 4 (`claude-sonnet-4-20250514`).
- Règles strictes : jamais d'hallucination, sources obligatoires, séparation facts/inferences.

**Ce qui manque** (fonctions listées dans le cahier des charges) :
- "Identifier les gaps d'investigation" → **ABSENT** comme endpoint dédié (l'assistant généraliste peut le faire mais pas de route structurée)
- "Comparer deux cas" → **ABSENT** (CaseTwin.tsx existe mais pas de route de comparaison IA)
- "Vérifier le wording légal" → **ABSENT** comme check automatique
- "Identifier ce qui est publiable" → **PARTIAL** — PUBLICATION CAUTION dans l'assistant, mais pas d'endpoint dédié

**Complexité :** LOW pour les endpoints dédiés (réutilise le même stack)
**Risque bêta :** LOW — additif
**Ordre recommandé :** 6ème (l'assistant est déjà excellent, les endpoints dédiés sont du confort)

**Routes à ajouter :** `/api/investigators/cases/[caseId]/intelligence-gaps`, `/api/investigators/cases/compare`
**Note :** Tout output IA doit rester loggé dans `AskLog`. Jamais de mode non-loggé.

---

### H. Security Ops Dashboard

**État actuel**

C'est le chantier **le plus complet et le plus proche du cahier des charges** :

- `app/admin/security/page.tsx` : page dashboard complète, métriques, incidents, vendors, action items, themes couleur correctes.
- `app/admin/security/incidents/page.tsx` : liste incidents.
- `app/admin/security/incidents/[id]/page.tsx` : détail incident.
- `src/lib/security/queries.ts` : `getSecurityOverview()`, `listIncidents()`, `listOpenActionItems()`, `listVendors()`, `listThreats()`.
- `src/lib/security/assessment/rules.ts` + `rules.test.ts` : règles d'évaluation des expositions.
- `src/lib/security/vendors/registry.ts` + `registry.test.ts` : registre des fournisseurs.
- `src/lib/security/email/digest.ts` : email digest.
- `app/api/admin/security/overview/route.ts` : overview avec fallback "migration_pending_or_db_error".
- `app/api/admin/security/incidents/route.ts`, `threats/route.ts`, `vendors/route.ts` : routes complètes.
- `app/api/admin/security/digests/generate/route.ts` + `send/route.ts` : génération et envoi digest.
- `app/api/cron/security-weekly-digest/route.ts` : cron hebdomadaire.
- 9 modèles Prisma Security* complets.

**Ce qui manque :**
- Flux NPM advisories automatique (actuellement absent des sources)
- CVE feed externe (absent)
- Le `overview/route.ts` contient un fallback "migration_pending" qui suggère que la migration n'a peut-être pas été appliquée en prod

**Complexité :** LOW (les quelques éléments manquants)
**Risque bêta :** LOW
**Ordre recommandé :** DÉJÀ DONE pour l'essentiel. Vérifier migration prod.

**Action immédiate :** Vérifier que les tables `SecurityVendor`, `SecurityIncident`, etc. existent bien en prod (le fallback dans `overview/route.ts` suggère une possible migration en attente).

---

## 7. Recommandation finale

### UN gros chantier prioritaire : **B — Evidence Snapshot System intégré au Vault**

### Branche recommandée : `feat/vault-evidence-snapshots`

### Pourquoi ce chantier d'abord

1. **Fondation critique** : sans preuve structurée dans les cas, les investigateurs n'ont que des entités et des notes libres. La chaîne de preuve est le cœur d'une investigation sérieuse.
2. **Socle existant** : modèle `EvidenceSnapshot` en prod, route GET existante, `r2-vault.ts` pour les uploads, `auth.server.ts` + `logAudit()` pour la sécurité. Il manque 4 fichiers.
3. **Additif pur** : zéro modification de code existant en production. 1 table Prisma additive. 0 risque de régression sur le scoring, le wallet scan, ou les routes publiques.
4. **Débloque la chaîne** : une fois les preuves dans les cas, l'IOC Export (F) et la Timeline (C) peuvent les consommer. C'est le prérequis naturel.
5. **Valeur immédiate** : les 6 investigateurs actifs sur le beta peuvent immédiatement archiver des captures, des URLs, des notes de source avec hash SHA-256 — c'est exactement ce qu'ils font manuellement aujourd'hui.

### Ce qu'il apporte

- Formulaire "Add Evidence" dans le workspace cas (URL, titre, sourceType, note, tags, entity lié, statut PRIVATE/SHAREABLE/PUBLISHABLE/REDACTED)
- Upload screenshot vers R2 (réutilise le système de fichiers du Vault)
- SHA-256 hash du contenu pour piste d'audit
- Server timestamp inviolable
- Audit log de chaque création/modification/suppression de preuve
- Base pour l'IOC Export et les rapports police

### Ce qu'il ne faut surtout pas faire

- **Ne pas toucher `EvidenceSnapshot`** (modèle public, sert le profil KOL et le dossier public). Créer une table `VaultEvidenceSnapshot` séparée.
- **Ne pas exposer les preuves Vault au public**. Tout passe par `getVaultWorkspace()` + `assertCaseOwnership()`.
- **Ne pas recréer le système de fichiers** — réutiliser `r2-vault.ts` tel quel.
- **Ne pas refactorer CaseExport.tsx** en même temps — c'est un fichier de 920 lignes qui fonctionne. Ajouter un panneau séparé.

---

## 8. Plan d'exécution technique

### Phase 0 — Audit et sécurité (0.5j)
- Vérifier que les tables Security* existent en prod (tester `GET /api/admin/security/overview`)
- Vérifier que `KolCrossLink` est absent du schema (confirmer le bug raw SQL de crossCaseLinker)
- Lancer `npx tsc --noEmit` sur la branche actuelle
- Lancer `npx vitest run` pour confirmer 1141 tests verts
- Vérifier les variables d'environnement R2 (VAULT_R2_BUCKET, R2_ACCOUNT_ID)

### Phase 1 — DB / Schema (0.5j)
```prisma
// À ajouter dans prisma/schema.prod.prisma (additif pur)
model VaultEvidenceSnapshot {
  id            String   @id @default(cuid())
  caseId        String
  workspaceId   String
  url           String?
  title         String
  sourceType    String   // web_page, x_twitter, telegram, etherscan, solscan, other
  note          String?
  tags          String[] @default([])
  entityId      String?  // lien optionnel vers VaultCaseEntity
  status        String   @default("PRIVATE") // PRIVATE | SHAREABLE | PUBLISHABLE | REDACTED
  sha256Hash    String?
  r2Key         String?  // screenshot R2
  capturedAt    DateTime @default(now())
  serverTs      DateTime @default(now())
  capturedBy    String   // profileId
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  case          VaultCase      @relation(fields: [caseId], references: [id], onDelete: Cascade)
  workspace     VaultWorkspace @relation(fields: [workspaceId], references: [id])
  entity        VaultCaseEntity? @relation(fields: [entityId], references: [id])

  @@index([caseId])
  @@index([workspaceId])
}
```
- Migration via Neon SQL Editor
- Ajouter la relation inverse dans `VaultCase` et `VaultCaseEntity`

### Phase 2 — API (1j)
- `app/api/investigators/cases/[caseId]/evidence/route.ts` : GET (list) + POST (create)
- `app/api/investigators/cases/[caseId]/evidence/[id]/route.ts` : GET + PUT + DELETE
- `app/api/investigators/cases/[caseId]/evidence/[id]/screenshot/route.ts` : POST presign R2
- Réutiliser `getVaultWorkspace()`, `assertCaseOwnership()`, `logAudit()`
- Rate limit sur POST (réutiliser `scanRateLimit.ts`)

### Phase 3 — UI (1j)
- `src/components/vault/EvidencePanel.tsx` : formulaire création + liste des preuves
  - Champs : URL, titre, sourceType (dropdown), note, tags (chips), entity liée (select), statut (PRIVATE/SHAREABLE/PUBLISHABLE/REDACTED)
  - Bouton upload screenshot → presign → upload R2 (même pattern que VaultCaseFile)
  - Affichage : liste avec badge statut couleur, date, source, hash SHA-256 tronqué
- Intégration dans `investigators/box/cases/[caseId]/page.tsx` comme section additionnelle

### Phase 4 — Audit logs / Sécurité (0.5j)
- Vérifier que chaque opération loggue dans `VaultAuditLog`
- Vérifier qu'aucune r2Key n'est jamais retournée au client
- Vérifier que le statut REDACTED bloque l'affichage du contenu (ne retourne que le titre et le statut)

### Phase 5 — Tests (0.5j)
- Tests Vitest pour les routes POST/GET/DELETE
- Mock R2 pour les tests d'upload
- Vérifier 1141+ tests toujours verts

### Phase 6 — Feature flag / Non-exposition (0j)
- Pas de feature flag nécessaire : l'Evidence Panel est dans le Vault (déjà derrière `VaultGate`)
- L'accès est contrôlé par `assertCaseOwnership()` — aucun risque d'exposition publique

---

## 9. Commandes à lancer

```bash
# TypeScript check
npx tsc --noEmit

# Tests (doit rester ≥ 1141)
npx vitest run

# Vérifier les tables Security* en prod (adapter avec ADMIN_TOKEN)
curl -H "x-admin-token: $ADMIN_TOKEN" https://app.interligens.com/api/admin/security/overview

# Chercher les TODO/FIXME dans le Vault
grep -rn "TODO\|FIXME\|MOCK\|stub\|NOT_IMPLEMENTED" src/components/vault/ src/app/investigators/

# Vérifier crossCaseLinker (raw SQL non migré)
grep -n "queryRaw\|KolCrossLink" src/lib/intelligence/crossCaseLinker.ts

# Vérifier les relations manquantes sur VaultCaseEntity
grep -n "VaultEvidenceSnapshot\|entityId" prisma/schema.prod.prisma

# Lister toutes les tables Vault actuelles
grep "^model Vault" prisma/schema.prod.prisma

# Vérifier l'export actuel CaseExport
grep -n "STIX\|stix\|ioc\|IOC\|csv.*export\|police" src/components/vault/CaseExport.tsx

# Vérifier la cohérence des noms KOL (dual naming)
grep -n "^model KOL\|^model Kol" prisma/schema.prod.prisma

# Vérifier les scripts de seed Arkham/MetaSleuth (manuels, non productifs)
ls src/scripts/seed/ | grep -i "arkham\|metasleuth\|chainabuse"

# Recherche deep links existants
grep -rn "etherscan.io\|solscan.io\|arkham\|breadcrumbs" src/components/vault/
```

---

## 10. Verdict clair

### Peut-on coder ça maintenant en branche sans risque pour la bêta ?

**OUI**, pour le chantier B (Evidence Snapshot). C'est additif pur. La seule opération à risque est la migration Prisma (1 table nouvelle) — qui, par convention INTERLIGENS, passe par le Neon SQL Editor, pas par `prisma db push`.

### Quel chantier est le plus intelligent ?

**B — Evidence Snapshot System** dans le Vault. Il pose la fondation des preuves structurées sans toucher au code existant en prod, débloque F (IOC Export) et C (Timeline), et répond au besoin immédiat des investigateurs.

### Combien de fichiers environ seront touchés ?

| Phase | Fichiers |
|---|---|
| Schema Prisma | 1 (additif) |
| Routes API | 3 nouveaux |
| Composant UI | 1 nouveau |
| Intégration page cas | 1 modifié (ajout section) |
| **Total** | **~6 fichiers** |

### Migration DB nécessaire ?

**Oui** — 1 table additive (`VaultEvidenceSnapshot`). Via Neon SQL Editor, pas de `prisma db push`. Risque : faible (additif pur).

### Doit rester derrière feature flag ?

**Non** — l'Evidence Panel est dans le Vault qui est déjà derrière `VaultGate` + `requireInvestigatorSession()`. Aucune donnée n'est publiquement exposée.

---

*Audit rédigé en mode lecture seule. Aucune modification de code. Aucun commit. Aucun déploiement.*
*Fichiers audités : schema.prod.prisma (28 555 lignes, 133 modèles), 350+ routes API, 19 composants vault/, 27 pages investigators/.*
