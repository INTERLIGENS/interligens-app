// __tests__/security/helpers/a4TwoTenantVault.ts
//
// A4 — LE MAGASIN À DEUX LOCATAIRES.
//
// Un balayage IDOR ne se démontre pas avec un mock par route : un mock rend ce
// qu'on lui a dit de rendre. Ici, les handlers d'`/api/investigators/*`
// tournent INCHANGÉS, avec leurs vrais helpers (`getVaultWorkspace`,
// `assertCaseOwnership`, `assertFileOwnership`, `validateSession`), et c'est
// LEUR propre clause `where` qui est évaluée contre deux locataires réellement
// distincts. Si une route oublie la portée du workspace, elle voit les lignes
// de l'autre — exactement comme en base.
//
// Sujet A : accès `acc-A`, workspace `ws-A`, dossier `case-A`.
// Sujet B : accès `acc-B`, workspace `ws-B`, dossier `case-B` + ses enfants.
//
// Toutes les valeurs de B portent le marqueur `SECRET-B`. Un test de lecture
// n'a donc pas à savoir ce qu'il cherche : il cherche ce marqueur dans le
// corps servi à A. Aucune donnée réelle, aucun nom civil, aucune connexion.

import { createHash } from "node:crypto";
import { makeModel, WriteJournal, type Row } from "./inMemoryPrisma";

/** Marqueur unique. Sa présence dans une réponse servie à A EST la fuite. */
export const MARQUEUR_B = "SECRET-B";

export const TOKEN_A = "a4-session-sujet-A-jeton-de-test-non-secret";
export const TOKEN_B = "a4-session-sujet-B-jeton-de-test-non-secret";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const DANS_LE_FUTUR = new Date(Date.now() + 86_400_000);
const EPOQUE = new Date("2026-01-01T00:00:00.000Z");

export interface DeuxLocataires {
  prisma: Record<string, unknown>;
  journal: WriteJournal;
  tables: Record<string, Row[]>;
}

/**
 * Construit un magasin neuf. Appelé dans `beforeEach` : chaque test part d'un
 * état identique, et une écriture d'un test ne peut pas verdir le suivant.
 */
export function construireDeuxLocataires(): DeuxLocataires {
  const journal = new WriteJournal();

  const tables: Record<string, Row[]> = {
    investigatorAccess: [
      { id: "acc-A", label: "SUJET-A", isActive: true },
      { id: "acc-B", label: "SUJET-B", isActive: true },
    ],
    investigatorSession: [
      {
        id: "sess-A",
        sessionTokenHash: sha256(TOKEN_A),
        investigatorAccessId: "acc-A",
        revokedAt: null,
        expiresAt: DANS_LE_FUTUR,
      },
      {
        id: "sess-B",
        sessionTokenHash: sha256(TOKEN_B),
        investigatorAccessId: "acc-B",
        revokedAt: null,
        expiresAt: DANS_LE_FUTUR,
      },
    ],
    vaultWorkspace: [
      { id: "ws-A", kdfSalt: "sel-de-A" },
      { id: "ws-B", kdfSalt: `sel-de-B-${MARQUEUR_B}` },
    ],
    vaultProfile: [
      { id: "prof-A", investigatorAccessId: "acc-A", handle: "sujet-a", workspaceId: "ws-A", contactEmail: null },
      { id: "prof-B", investigatorAccessId: "acc-B", handle: "sujet-b", workspaceId: "ws-B", contactEmail: null },
    ],
    vaultCase: [
      {
        id: "case-A",
        workspaceId: "ws-A",
        titleEnc: "titre-de-A",
        titleIv: "iv-A",
        tagsEnc: null,
        tagsIv: null,
        status: "PRIVATE",
        caseTemplate: null,
        createdAt: EPOQUE,
        updatedAt: EPOQUE,
        archivedAt: null,
      },
      {
        id: "case-B",
        workspaceId: "ws-B",
        titleEnc: `titre-de-B-${MARQUEUR_B}`,
        titleIv: "iv-B",
        tagsEnc: null,
        tagsIv: null,
        status: "PRIVATE",
        caseTemplate: null,
        createdAt: EPOQUE,
        updatedAt: EPOQUE,
        archivedAt: null,
      },
    ],
    vaultCaseNote: [
      { id: "note-B", caseId: "case-B", contentEnc: `note-de-B-${MARQUEUR_B}`, contentIv: "iv", createdAt: EPOQUE, updatedAt: EPOQUE },
    ],
    vaultCaseEntity: [
      // Même `value` des deux côtés : c'est le carburant de l'oracle de
      // collision, et la seule donnée volontairement partagée du magasin.
      { id: "ent-A", caseId: "case-A", value: "0xVALEUR-PARTAGEE", type: "WALLET", sourceFileId: null },
      { id: "ent-B", caseId: "case-B", value: "0xVALEUR-PARTAGEE", type: "WALLET", sourceFileId: null },
    ],
    vaultCaseFile: [
      {
        id: "file-B",
        caseId: "case-B",
        r2Key: `vault/ws-B/case-B/${MARQUEUR_B}.pdf`,
        mimeType: "application/pdf",
        filenameEnc: `nom-de-B-${MARQUEUR_B}`,
        filenameIv: "iv",
        sizeBytes: 1024,
        uploadedAt: EPOQUE,
        parseStatus: "PENDING",
        parsedAt: null,
        entitiesFound: 0,
        parseMode: null,
        parseError: null,
      },
    ],
    vaultHypothesis: [
      { id: "hyp-B", caseId: "case-B", titleEnc: `hypothese-de-B-${MARQUEUR_B}`, status: "OPEN", confidence: 50 },
    ],
    vaultTimelineEvent: [
      { id: "evt-B", caseId: "case-B", labelEnc: `evenement-de-B-${MARQUEUR_B}`, occurredAt: EPOQUE },
    ],
    vaultCaseShare: [
      { id: "share-B", caseId: "case-B", workspaceId: "ws-B", token: "jeton-de-partage-B", revokedAt: null, expiresAt: DANS_LE_FUTUR },
    ],
    vaultNetworkGraph: [
      {
        id: "graph-B",
        workspaceId: "ws-B",
        title: `graphe-de-B-${MARQUEUR_B}`,
        description: null,
        payloadEnc: `charge-de-B-${MARQUEUR_B}`,
        payloadIv: "iv",
        visibility: "PRIVATE",
        nodeCount: 1,
        edgeCount: 0,
        updatedAt: EPOQUE,
      },
    ],
    // `conv-B` : A n'y appartient PAS. `conv-A` : il y appartient.
    // Les deux sont nécessaires — un test qui ne vérifierait que le refus
    // passerait aussi si la route refusait TOUT LE MONDE.
    conversation: [
      { id: "conv-B", scopeType: "direct", status: "open", lastMessageAt: EPOQUE },
      { id: "conv-A", scopeType: "direct", status: "open", lastMessageAt: EPOQUE },
    ],
    conversationParticipant: [
      { id: "cp-B", conversationId: "conv-B", accessId: "acc-B", joinedAt: EPOQUE, lastReadAt: null },
      { id: "cp-BF", conversationId: "conv-B", accessId: "founder", joinedAt: EPOQUE, lastReadAt: null },
      { id: "cp-A", conversationId: "conv-A", accessId: "acc-A", joinedAt: EPOQUE, lastReadAt: null },
      { id: "cp-AF", conversationId: "conv-A", accessId: "founder", joinedAt: EPOQUE, lastReadAt: null },
    ],
    message: [
      { id: "msg-B1", conversationId: "conv-B", senderAccessId: "founder", senderName: "founder", body: `message-1-${MARQUEUR_B}`, priority: "normal", kind: "message", createdAt: EPOQUE },
      { id: "msg-B2", conversationId: "conv-B", senderAccessId: "founder", senderName: "founder", body: `message-2-${MARQUEUR_B}`, priority: "normal", kind: "message", createdAt: EPOQUE },
      { id: "msg-A1", conversationId: "conv-A", senderAccessId: "founder", senderName: "founder", body: "message-pour-A", priority: "normal", kind: "message", createdAt: EPOQUE },
    ],
    messageRead: [],
    vaultAuditLog: [],
    vaultFeedback: [],
    feedbackEntry: [],
  };

  const t = (nom: string) => tables[nom];
  const parId = (nom: string, id: unknown) => t(nom).find((r) => r.id === id) ?? null;

  const modele = (nom: string, opts: Parameters<typeof makeModel>[1] = {}) =>
    makeModel(tables[nom], { ...opts, name: nom, journal });

  const prisma: Record<string, unknown> = {
    investigatorAccess: modele("investigatorAccess"),

    investigatorSession: modele("investigatorSession", {
      includes: { access: (row) => parId("investigatorAccess", row.investigatorAccessId) },
    }),

    vaultProfile: modele("vaultProfile", {
      includes: { workspace: (row) => parId("vaultWorkspace", row.workspaceId) },
    }),

    vaultWorkspace: modele("vaultWorkspace"),
    vaultCase: modele("vaultCase", {
      counts: (row) => ({
        entities: t("vaultCaseEntity").filter((e) => e.caseId === row.id).length,
        files: t("vaultCaseFile").filter((f) => f.caseId === row.id).length,
        notes: t("vaultCaseNote").filter((n) => n.caseId === row.id).length,
      }),
    }),

    // `case: { workspaceId }` — la clause qu'emploie l'oracle de collision.
    vaultCaseEntity: modele("vaultCaseEntity", {
      relations: { case: (row) => parId("vaultCase", row.caseId) },
    }),

    vaultCaseNote: modele("vaultCaseNote"),
    vaultCaseFile: modele("vaultCaseFile"),
    vaultHypothesis: modele("vaultHypothesis"),
    vaultTimelineEvent: modele("vaultTimelineEvent"),
    vaultCaseShare: modele("vaultCaseShare"),
    vaultNetworkGraph: modele("vaultNetworkGraph"),
    vaultAuditLog: modele("vaultAuditLog"),
    vaultFeedback: modele("vaultFeedback"),
    feedbackEntry: modele("feedbackEntry"),

    conversation: modele("conversation", {
      relations: { participants: (row) => t("conversationParticipant").filter((p) => p.conversationId === row.id) },
      includes: {
        participants: (row) => t("conversationParticipant").filter((p) => p.conversationId === row.id),
        messages: (row, sub) => {
          const msgs = t("message").filter((m) => m.conversationId === row.id);
          const inc = (sub as { include?: { readBy?: { where?: unknown } } })?.include;
          if (!inc?.readBy) return msgs;
          const filtre = inc.readBy.where as { accessId?: string } | undefined;
          return msgs.map((m) => ({
            ...m,
            readBy: t("messageRead").filter(
              (r) => r.messageId === m.id && (!filtre?.accessId || r.accessId === filtre.accessId),
            ),
          }));
        },
      },
    }),

    conversationParticipant: modele("conversationParticipant"),

    message: modele("message", {
      relations: { readBy: (row) => t("messageRead").filter((r) => r.messageId === row.id) },
      includes: { readBy: (row) => t("messageRead").filter((r) => r.messageId === row.id) },
    }),

    messageRead: modele("messageRead"),
  };

  return { prisma, journal, tables };
}

/**
 * Passe-plat pour `vi.mock("@/lib/prisma")`.
 *
 * La fabrique d'un `vi.mock` est hissée : elle ne peut pas fermer sur une
 * variable du fichier de test. Elle importe donc ce module et lit `courant`,
 * que le `beforeEach` réassigne avant chaque test.
 */
export const magasinCourant: { valeur: DeuxLocataires | null } = { valeur: null };
