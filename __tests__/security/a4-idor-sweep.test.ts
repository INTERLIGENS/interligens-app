// __tests__/security/a4-idor-sweep.test.ts
//
// A4 — BALAYAGE IDOR DES ROUTES PARAMÉTRÉES.
//
// Une session VALIDE de sujet A vise les ressources de sujet B, sur les routes
// `[caseId]`, `[fileId]`, `[entityId]`, `[noteId]`, `[hypothesisId]`,
// `[eventId]`, `[shareId]`, `[id]`.
//
// ── DEUX MOITIÉS, ET ELLES NE DISENT PAS LA MÊME CHOSE ────────────────────
//
//   LECTURE   — A obtient-il des OCTETS de B ? Se lit dans le corps servi :
//               le marqueur `SECRET-B` y est, ou il n'y est pas.
//   ÉCRITURE  — A modifie-t-il quelque chose ? Ne se lit PAS dans le statut :
//               une route peut rendre 403 après avoir écrit, ou rendre 200 en
//               écrivant chez un autre locataire. Le journal du magasin
//               enregistre donc chaque mutation, avec ses arguments.
//
// La distinction n'est pas cosmétique. `POST /api/investigators/feedback`
// n'exfiltre RIEN : il inscrit `workspaceId: ws-A` avec `caseId: case-B` dans
// `VaultAuditLog`. Classer cela en « fuite » le sous-estimerait et le
// classerait dans la mauvaise colonne. C'est une atteinte à l'INTÉGRITÉ DU
// JOURNAL D'AUDIT — la pièce qui fait foi dans un produit de chaîne de
// conservation. Les noms de tests ci-dessous le disent.
//
// ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
//
// Il ne corrige RIEN. Les cinq constats de la section 3 sont figés dans l'état
// mesuré le 2026-08-18 : ils passent au VERT tant que le défaut est là, et
// tombent au ROUGE le jour où quelqu'un y touche — dans un sens comme dans
// l'autre. Un correctif de septembre devra donc modifier ce fichier
// délibérément, ce qui est exactement le but : aucune correction silencieuse,
// aucune régression silencieuse.
//
// ── LIMITE ASSUMÉE ────────────────────────────────────────────────────────
//
// Sonde EN PROCESSUS. Elle exerce la logique d'autorisation des handlers, pas
// PostgreSQL, pas Vercel, pas Cloudflare. Même limite `U1` que la tâche 6 du
// rapport d'août : les couches amont ne peuvent que normaliser davantage, mais
// « devraient » n'est pas « mesuré ».

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  construireDeuxLocataires,
  magasinCourant,
  MARQUEUR_B,
  TOKEN_A,
  type DeuxLocataires,
} from "./helpers/a4TwoTenantVault";

// La fabrique est hissée : elle passe par `magasinCourant`, réassigné en
// `beforeEach`, plutôt que de fermer sur une variable de ce fichier.
vi.mock("@/lib/prisma", async () => {
  const { magasinCourant: holder } = await import("./helpers/a4TwoTenantVault");
  const prisma = new Proxy(
    {},
    {
      get(_cible, propriete: string) {
        const magasin = holder.valeur;
        if (!magasin) throw new Error("A4 : magasin non construit (beforeEach manquant)");
        const delegue = (magasin.prisma as Record<string, unknown>)[propriete];
        if (!delegue) throw new Error(`A4 : modèle non provisionné dans le magasin -> ${propriete}`);
        return delegue;
      },
    },
  );
  return { prisma, default: prisma };
});

// R2 n'est pas la cible de ce balayage : on veut savoir si la route CONSENT à
// signer une clé, pas si S3 répond. La fausse URL contient la clé demandée,
// donc une signature accordée à tort porterait le marqueur de B.
vi.mock("@/lib/vault/r2-vault", () => ({
  generateR2Key: (ws: string, c: string) => `vault/${ws}/${c}/x`,
  generatePresignedGetUrl: async (cle: string) => `https://r2.invalid/GET?key=${cle}`,
  generatePresignedPutUrl: async (cle: string) => `https://r2.invalid/PUT?key=${cle}`,
  deleteVaultObject: async () => undefined,
}));

// ── Identifiants ────────────────────────────────────────────────────────────

const B = {
  caseId: "case-B",
  noteId: "note-B",
  entityId: "ent-B",
  fileId: "file-B",
  hypothesisId: "hyp-B",
  eventId: "evt-B",
  shareId: "share-B",
  graphId: "graph-B",
  conversationId: "conv-B",
};
const A = { caseId: "case-A" };

let magasin: DeuxLocataires;

beforeEach(() => {
  magasin = construireDeuxLocataires();
  magasinCourant.valeur = magasin;
  // `sendEmail` de la route feedback part en réseau si la clé est posée.
  // On la vide : la route bascule sur son écriture en base, qui EST l'objet
  // du constat 3.3, et aucun appel sortant ne peut avoir lieu depuis la suite.
  vi.stubEnv("RESEND_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  magasinCourant.valeur = null;
});

// ── Outils ──────────────────────────────────────────────────────────────────

function requeteDeA(init: { method?: string; corps?: unknown; query?: string } = {}) {
  return new NextRequest(`https://app.invalid/api/investigators/x${init.query ?? ""}`, {
    method: init.method ?? "GET",
    headers: { cookie: `investigator_session=${TOKEN_A}`, "content-type": "application/json" },
    ...(init.corps !== undefined ? { body: JSON.stringify(init.corps) } : {}),
  });
}

// Générique : chaque handler déclare son propre `RouteCtx`, et le type
// littéral de `p` doit lui rester assignable.
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

/** Statut + corps sérialisé — la moitié LECTURE de chaque sonde. */
async function lire(res: Response): Promise<{ statut: number; corps: string }> {
  return { statut: res.status, corps: JSON.stringify(await res.json().catch(() => null)) };
}

/**
 * Mutations métier — journal d'audit EXCLU.
 *
 * `logAudit` écrit à chaque passage réussi ; le confondre avec l'effet métier
 * ferait passer « la route a tracé » pour « la route a modifié ». Le journal
 * d'audit est examiné à part, et pour lui-même, en section 3.3.
 */
const mutationsMetier = () => magasin.journal.except("vaultAuditLog", "investigatorSession");

// ═══════════════════════════════════════════════════════════════════════════
// 1. LECTURE — A n'obtient aucun octet de B
// ═══════════════════════════════════════════════════════════════════════════

describe("A4 · LECTURE — sujet A ne lit rien de sujet B", () => {
  it("GET /cases/[caseId] — le dossier de B : 403, aucun octet de B", async () => {
    const { GET } = await import("@/app/api/investigators/cases/[caseId]/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ caseId: B.caseId })));
    expect(statut).toBe(403);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /cases/[caseId]/notes — les notes de B : 403, aucun octet de B", async () => {
    const { GET } = await import("@/app/api/investigators/cases/[caseId]/notes/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ caseId: B.caseId })));
    expect(statut).toBe(403);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /cases/[caseId]/files — les fichiers de B : 403, aucun octet de B", async () => {
    const { GET } = await import("@/app/api/investigators/cases/[caseId]/files/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ caseId: B.caseId })));
    expect(statut).toBe(403);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /files/[fileId]/url — aucune URL R2 signée sur le fichier de B, par l'un ou l'autre chemin", async () => {
    const { GET } = await import("@/app/api/investigators/cases/[caseId]/files/[fileId]/url/route");
    // Chemin 1 : le dossier de B est nommé directement.
    const direct = await lire(await GET(requeteDeA(), ctx({ caseId: B.caseId, fileId: B.fileId })));
    // Chemin 2 : le dossier de A est nommé, le fichier de B greffé dessous.
    const greffe = await lire(await GET(requeteDeA(), ctx({ caseId: A.caseId, fileId: B.fileId })));
    expect(direct.statut).toBe(403);
    expect(greffe.statut).toBe(403);
    expect(direct.corps).not.toContain(MARQUEUR_B);
    expect(greffe.corps).not.toContain(MARQUEUR_B);
  });

  it("GET /graphs/[id] — le graphe de B : 404, aucun octet de B", async () => {
    const { GET } = await import("@/app/api/investigators/graphs/[id]/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ id: B.graphId })));
    expect(statut).toBe(404);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /messages/[id] — la conversation de B : 403 « Not a participant »", async () => {
    const { GET } = await import("@/app/api/investigators/messages/[id]/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ id: B.conversationId })));
    expect(statut).toBe(403);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /workspace/salt — le sel de A, jamais celui de B", async () => {
    const { GET } = await import("@/app/api/investigators/workspace/salt/route");
    const { statut, corps } = await lire(await GET(requeteDeA()));
    expect(statut).toBe(200);
    expect(corps).toContain("sel-de-A");
    expect(corps).not.toContain(MARQUEUR_B);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ÉCRITURE — A ne modifie rien chez B
//
// Chaque cas exige DEUX choses, et la seconde est celle qui compte : le statut
// refusé, ET zéro mutation métier au journal. Une route qui rendrait 403 après
// avoir écrit passerait le premier contrôle.
// ═══════════════════════════════════════════════════════════════════════════

describe("A4 · ÉCRITURE — sujet A ne modifie rien de sujet B", () => {
  it("PATCH /cases/[caseId] — le dossier de B reste intact", async () => {
    const { PATCH } = await import("@/app/api/investigators/cases/[caseId]/route");
    const { statut } = await lire(
      await PATCH(requeteDeA({ method: "PATCH", corps: { titleEnc: "ECRASE", titleIv: "x" } }), ctx({ caseId: B.caseId })),
    );
    expect(statut).toBe(403);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCase.find((c) => c.id === B.caseId)!.titleEnc).toContain(MARQUEUR_B);
  });

  it("DELETE /cases/[caseId] — le dossier de B n'est pas supprimé", async () => {
    const { DELETE } = await import("@/app/api/investigators/cases/[caseId]/route");
    const { statut } = await lire(await DELETE(requeteDeA({ method: "DELETE" }), ctx({ caseId: B.caseId })));
    expect(statut).toBe(403);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCase.some((c) => c.id === B.caseId)).toBe(true);
  });

  // Le vecteur qui compte pour les routes enfants : la possession du PARENT est
  // satisfaite (A nomme SON dossier), l'enfant appartient à B. Une route qui se
  // contenterait d'`assertCaseOwnership` tomberait ici.
  it("PATCH /notes/[noteId] — parent = dossier de A, note = celle de B : refus, note intacte", async () => {
    const { PATCH } = await import("@/app/api/investigators/cases/[caseId]/notes/[noteId]/route");
    const { statut } = await lire(
      await PATCH(
        requeteDeA({ method: "PATCH", corps: { contentEnc: "ECRASE", contentIv: "x" } }),
        ctx({ caseId: A.caseId, noteId: B.noteId }),
      ),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCaseNote.find((n) => n.id === B.noteId)!.contentEnc).toContain(MARQUEUR_B);
  });

  it("DELETE /entities/[entityId] — parent = dossier de A, entité = celle de B : refus, entité intacte", async () => {
    const { DELETE } = await import("@/app/api/investigators/cases/[caseId]/entities/[entityId]/route");
    const { statut } = await lire(
      await DELETE(requeteDeA({ method: "DELETE" }), ctx({ caseId: A.caseId, entityId: B.entityId })),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCaseEntity.some((e) => e.id === B.entityId)).toBe(true);
  });

  it("PATCH /hypotheses/[hypothesisId] — parent = dossier de A, hypothèse = celle de B : refus, statut intact", async () => {
    const { PATCH } = await import("@/app/api/investigators/cases/[caseId]/hypotheses/[hypothesisId]/route");
    const { statut } = await lire(
      await PATCH(
        requeteDeA({ method: "PATCH", corps: { status: "CONFIRMED" } }),
        ctx({ caseId: A.caseId, hypothesisId: B.hypothesisId }),
      ),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultHypothesis.find((h) => h.id === B.hypothesisId)!.status).toBe("OPEN");
  });

  it("PATCH /timeline-events/[eventId] — parent = dossier de A, événement = celui de B : refus, événement intact", async () => {
    const { PATCH } = await import("@/app/api/investigators/cases/[caseId]/timeline-events/[eventId]/route");
    const { statut } = await lire(
      await PATCH(requeteDeA({ method: "PATCH", corps: { labelEnc: "ECRASE" } }), ctx({ caseId: A.caseId, eventId: B.eventId })),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultTimelineEvent.find((e) => e.id === B.eventId)!.labelEnc).toContain(MARQUEUR_B);
  });

  it("DELETE /share/[shareId] — parent = dossier de A, partage = celui de B : refus, partage non révoqué", async () => {
    const { DELETE } = await import("@/app/api/investigators/cases/[caseId]/share/[shareId]/route");
    const { statut } = await lire(
      await DELETE(requeteDeA({ method: "DELETE" }), ctx({ caseId: A.caseId, shareId: B.shareId })),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCaseShare.find((s) => s.id === B.shareId)!.revokedAt).toBeNull();
  });

  it("PATCH /files/[fileId]/finalize — parent = dossier de A, fichier = celui de B : refus, état de parsing intact", async () => {
    const { PATCH } = await import("@/app/api/investigators/cases/[caseId]/files/[fileId]/finalize/route");
    const { statut } = await lire(
      await PATCH(requeteDeA({ method: "PATCH", corps: { parseStatus: "FAILED" } }), ctx({ caseId: A.caseId, fileId: B.fileId })),
    );
    expect(statut).toBe(403);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCaseFile.find((f) => f.id === B.fileId)!.parseStatus).toBe("PENDING");
  });

  it("DELETE /files/[fileId] — parent = dossier de A, fichier = celui de B : refus, fichier et objet R2 intacts", async () => {
    const { DELETE } = await import("@/app/api/investigators/cases/[caseId]/files/[fileId]/route");
    const { statut } = await lire(
      await DELETE(requeteDeA({ method: "DELETE" }), ctx({ caseId: A.caseId, fileId: B.fileId })),
    );
    expect(statut).toBe(403);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultCaseFile.some((f) => f.id === B.fileId)).toBe(true);
  });

  it("GET /files/[fileId]/presign — aucune URL d'ÉCRITURE R2 sur le fichier de B", async () => {
    const { GET } = await import("@/app/api/investigators/cases/[caseId]/files/[fileId]/presign/route");
    const { statut, corps } = await lire(await GET(requeteDeA(), ctx({ caseId: A.caseId, fileId: B.fileId })));
    expect(statut).toBe(403);
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("PATCH /graphs/[id] — le graphe de B n'est pas modifié", async () => {
    const { PATCH } = await import("@/app/api/investigators/graphs/[id]/route");
    const { statut } = await lire(
      await PATCH(requeteDeA({ method: "PATCH", corps: { title: "ECRASE" } }), ctx({ id: B.graphId })),
    );
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultNetworkGraph.find((g) => g.id === B.graphId)!.title).toContain(MARQUEUR_B);
  });

  it("DELETE /graphs/[id] — le graphe de B n'est pas supprimé", async () => {
    const { DELETE } = await import("@/app/api/investigators/graphs/[id]/route");
    const { statut } = await lire(await DELETE(requeteDeA({ method: "DELETE" }), ctx({ id: B.graphId })));
    expect(statut).toBe(404);
    expect(mutationsMetier()).toHaveLength(0);
    expect(magasin.tables.vaultNetworkGraph.some((g) => g.id === B.graphId)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CONSTATS NON CORRIGÉS — figés dans l'état mesuré le 2026-08-18
//
// Ces tests décrivent un DÉFAUT. Ils sont verts parce que le défaut est là.
// Le jour où il est corrigé, ils tombent : c'est le signal, pas l'accident.
// ═══════════════════════════════════════════════════════════════════════════

describe("A4 · CONSTAT — fuite de LECTURE, non corrigée", () => {
  it("PATCH /messages/[id] : A obtient le VOLUME d'une conversation dont il n'est pas participant", async () => {
    const { PATCH } = await import("@/app/api/investigators/messages/[id]/route");
    const { statut, corps } = await lire(
      await PATCH(requeteDeA({ method: "PATCH" }), ctx({ id: B.conversationId })),
    );

    // Le `GET` de la MÊME route vérifie la participation et rend 403. Le
    // `PATCH` ne la vérifie pas : il part directement sur `message.findMany`.
    expect(statut).toBe(200);
    expect(JSON.parse(corps).markedRead).toBe(2); // = le nombre de messages de B

    // Le contenu, lui, ne sort pas : la fuite est un COMPTE, pas des octets.
    expect(corps).not.toContain(MARQUEUR_B);
  });

  it("GET /entities/collisions : oracle d'existence inter-locataires, sans limiteur", async () => {
    const { GET } = await import("@/app/api/investigators/entities/collisions/route");
    const { statut, corps } = await lire(await GET(requeteDeA({ query: `?caseId=${A.caseId}` })));

    // A a semé `0xVALEUR-PARTAGEE` dans SON dossier ; la route lui confirme
    // qu'un autre workspace la détient. Mécanisme voulu (détection de
    // collision), mais interrogé valeur par valeur c'est un test
    // d'appartenance sur le contenu des dossiers d'autrui.
    expect(statut).toBe(200);
    expect(JSON.parse(corps)).toEqual({ hasCollisions: true, collisionCount: 1 });

    // Ce qui le borne : ni identité, ni workspace, ni valeur ne ressortent.
    expect(corps).not.toContain(MARQUEUR_B);
    expect(corps).not.toContain("ws-B");
  });
});

describe("A4 · CONSTAT — ÉCRITURE chez autrui, non corrigée", () => {
  it("PATCH /messages/[id] : A inscrit des lignes MessageRead sur les messages d'une conversation dont il n'est pas participant", async () => {
    const { PATCH } = await import("@/app/api/investigators/messages/[id]/route");
    await PATCH(requeteDeA({ method: "PATCH" }), ctx({ id: B.conversationId }));

    const ecrites = magasin.tables.messageRead;
    expect(ecrites).toHaveLength(2);
    expect(ecrites.every((r) => r.accessId === "acc-A")).toBe(true);
    expect(ecrites.map((r) => r.messageId).sort()).toEqual(["msg-B1", "msg-B2"]);

    // Le second effet est nul, et c'est ce qui rend l'anomalie lisible : la
    // route met à jour `lastReadAt` du PARTICIPANT — et A n'en est pas un.
    const surParticipant = magasin.journal.on("conversationParticipant");
    expect(surParticipant).toHaveLength(1);
    expect(surParticipant[0].affected).toBe(0);
  });
});

describe("A4 · CONSTAT — ATTEINTE À L'INTÉGRITÉ DU JOURNAL D'AUDIT, non corrigée", () => {
  it("POST /feedback : A inscrit dans VaultAuditLog une entrée liant SON workspace au dossier d'un AUTRE locataire", async () => {
    const { POST } = await import("@/app/api/investigators/feedback/route");
    const { statut } = await lire(
      await POST(requeteDeA({ method: "POST", corps: { message: "bonjour", caseId: B.caseId } })),
    );
    expect(statut).toBe(200);

    // Ce n'est PAS une fuite : rien de B n'est servi à A.
    // C'est une entrée FAUSSE écrite dans la pièce qui fait foi.
    const audit = magasin.tables.vaultAuditLog;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      investigatorAccessId: "acc-A",
      workspaceId: "ws-A",
      caseId: "case-B", // ← le dossier d'un autre locataire
      action: "FEEDBACK_SENT",
    });

    // Même chose côté métier : la ligne de feedback porte la même incohérence.
    expect(magasin.tables.vaultFeedback[0]).toMatchObject({ workspaceId: "ws-A", caseId: "case-B" });
  });

  it("POST /feedback : le schéma ne rattrape rien — `caseId` accepte une chaîne arbitraire", async () => {
    // `VaultFeedback.caseId` et `VaultAuditLog.caseId` sont des `String?` NUS
    // dans schema.prod.prisma : aucune relation, aucune clé étrangère. Ce test
    // fige la conséquence — l'hypothèse « une FK rejetterait un caseId
    // étranger » est fausse, et elle l'est pour toute valeur, pas seulement
    // pour un identifiant d'un autre locataire.
    const { POST } = await import("@/app/api/investigators/feedback/route");
    await POST(requeteDeA({ method: "POST", corps: { message: "bonjour", caseId: "dossier-qui-n-existe-pas" } }));

    expect(magasin.tables.vaultAuditLog[0]).toMatchObject({ caseId: "dossier-qui-n-existe-pas" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA FORCE DE LA CREDENTIAL — « session valide » n'est pas exigée partout
//
// Le balayage suppose une session VALIDE de sujet A. Sur les routes `[handle]`
// et `[id]` nominatives, cette hypothèse est plus forte que ce que le code
// exige : le gate se contente de la PRÉSENCE d'un cookie. La limite est
// documentée dans nominativeApiGate.ts ; ce qui suit la MESURE, et nomme les
// routes paramétrées qui n'ont aucune seconde couche derrière elle.
// ═══════════════════════════════════════════════════════════════════════════

describe("A4 · CONSTAT — le gate nominatif accepte un cookie non validé", () => {
  it("un cookie forgé est reconnu comme `beta_session`, un absent ne l'est pas", async () => {
    const { resolveNominativeCaller } = await import("@/lib/security/nominativeApiGate");
    const requete = (cookie?: string) =>
      new NextRequest("https://app.invalid/api/cluster/exemple", {
        headers: cookie ? { cookie } : {},
      });

    expect(resolveNominativeCaller(requete())).toBeNull();
    expect(resolveNominativeCaller(requete("investigator_session="))).toBeNull();
    expect(resolveNominativeCaller(requete("investigator_session=ceci-n-est-pas-une-session"))).toBe(
      "beta_session",
    );
  });

  it("les routes paramétrées qui n'ont QUE ce gate sont nommées, et la liste ne grandit pas en silence", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { isNominativeApiPath } = await import("@/lib/security/nominativeApiGate");

    // Routes `[param]` nominatives dont une partie du contenu n'est protégée
    // QUE par le gate ci-dessus, au 2026-08-18.
    //
    // `gardeAbsent` est nommé garde par garde, et non « aucun garde » : la
    // formulation grossière serait fausse pour `watchlist/signals/[id]`, qui
    // redacte bien le MONTANT (`redactProceeds`) tout en servant l'IDENTITÉ
    // d'un profil non publié. Ce qui manque n'est pas le même objet selon la
    // route, et le test doit le dire.
    const SANS_SECONDE_COUCHE = [
      {
        chemin: "/api/watchlist/signals/abc",
        fichier: "src/app/api/watchlist/signals/[id]/route.ts",
        sert: "handle, displayName, tier, riskFlag — pour un profil NON publié",
        gardePresent: ["redactProceeds"], // le montant, lui, est bien filtré
        gardeAbsent: ["PUBLIC_KOL_FILTER"],
      },
      {
        chemin: "/api/kol/exemple/shill-to-exit",
        fichier: "src/app/api/kol/[handle]/shill-to-exit/route.ts",
        sert: "amountUsd par événement de sortie, et la phrase « Sold on … — $X »",
        gardePresent: [],
        gardeAbsent: ["PUBLIC_KOL_FILTER", "redactProceeds", "isProceedsPublished", "monetaryGate"],
      },
    ];

    for (const r of SANS_SECONDE_COUCHE) {
      expect(isNominativeApiPath(r.chemin), `${r.chemin} n'est plus vu comme nominatif`).toBe(true);
      const src = fs.readFileSync(path.join(process.cwd(), r.fichier), "utf8");

      for (const garde of r.gardePresent) {
        expect(src.includes(garde), `${r.fichier} a PERDU ${garde}`).toBe(true);
      }
      for (const garde of r.gardeAbsent) {
        expect(
          src.includes(garde),
          `${r.fichier} porte désormais ${garde} — le retirer de gardeAbsent (${r.sert})`,
        ).toBe(false);
      }
    }
  });
});
