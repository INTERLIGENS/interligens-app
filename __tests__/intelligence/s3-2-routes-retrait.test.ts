// ─── S3.2 · LES DEUX ROUTES QUI SUPPRIMENT, VERROUILLÉES ───────────────────
//
// ██  Le champ était servi sans être exigé. Deuxième fois.                 ██
//
// Après avoir câblé les routes, j'ai muté `assessSanction(false, coverage,
// "WITHHELD")` en `assessSanction(false, coverage)` et lancé la suite
// complète : 425 fichiers, 5675 tests, TOUS VERTS. Le mutant survit.
//
// C'est exactement #354 — un contrat servi que rien ne verrouille. Je l'ai
// mesuré AVANT de merger cette fois, au lieu de l'annoncer et de le découvrir
// après.
//
// ─── Ce que ces tests exigent ─────────────────────────────────────────────
//
//   1. un match TROUVÉ puis retiré ne rend jamais NO_MATCH_COMPLETE
//   2. la charge utile ne porte AUCUN champ qui trahisse le retrait
//   3. une absence VRAIE garde son négatif concluant
//   4. `hasSanction` reste `false` sur retrait — on ne divulgue pas
//
// ─── Le témoin ───────────────────────────────────────────────────────────
//
// `TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz`, observation `ofac`/SANCTION ACTIVE,
// mesurée le 2026-09-09 : le matcher rend `matchCount: 1` et `hasSanction:
// true` ; les routes servaient `NO_MATCH_COMPLETE` avec
// `negativeIsConclusive: true`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const COUVERTURE = {
  expected: ["ofac"],
  consulted: ["ofac"],
  notConsulted: [],
  declaredNotArmed: [
    { source: "amf", reason: "NOT_MEASURED" },
    { source: "fca", reason: "NOT_MEASURED" },
  ],
  state: "COMPLETE",
  negativeIsConclusive: true,
} as const;

const lookupMock = vi.fn();
const matchMock = vi.fn();
const entiteMock = vi.fn();

vi.mock("@/lib/intelligence", () => ({
  lookupValue: (...a: unknown[]) => lookupMock(...a),
  matchEntity: (...a: unknown[]) => matchMock(...a),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { canonicalEntity: { findUnique: (...a: unknown[]) => entiteMock(...a) } },
}));

// La lecture de couverture fait un aller-retour base — mockée pour la même
// raison que sur le corpus partenaire : ce fichier juge le contrat de route,
// pas l'état des collecteurs.
vi.mock("@/lib/intelligence/sanctionCoverage", async (orig) => {
  const reel = await orig<typeof import("@/lib/intelligence/sanctionCoverage")>();
  return { ...reel, readSanctionCoverage: vi.fn(async () => COUVERTURE) };
});

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  rateLimitResponse: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  detectLocale: vi.fn(() => "en"),
  RATE_LIMIT_PRESETS: { scan: {}, intelligence: {} },
}));

const TEMOIN = "TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz";

/** Le signal que le matcher rend RÉELLEMENT sur le témoin. Mesuré. */
const SIGNAL_TROUVE = {
  ims: 100,
  ics: 0.95,
  matchCount: 1,
  hasSanction: true,
  topRiskClass: "SANCTION",
  matchBasis: "EXACT",
  sourceSlug: "ofac",
  externalUrl: null,
  winner: null,
  publicationState: "PUBLISHED",
};

const SIGNAL_VIDE = {
  ims: 0,
  ics: 0,
  matchCount: 0,
  hasSanction: false,
  topRiskClass: null,
  matchBasis: null,
  sourceSlug: null,
  externalUrl: null,
  winner: null,
  publicationState: "PUBLISHED",
};

const ROUTES = [
  { nom: "scan/intelligence", mod: "@/app/api/scan/intelligence/route", url: "http://localhost/api/scan/intelligence" },
  { nom: "intelligence/match", mod: "@/app/api/intelligence/match/route", url: "http://localhost/api/intelligence/match" },
] as const;

beforeEach(() => {
  vi.resetModules();
  lookupMock.mockReset();
  matchMock.mockReset();
  entiteMock.mockReset();
});

async function servir(mod: string, url: string, value: string) {
  const { GET } = (await import(mod)) as { GET: (r: Request) => Promise<Response> };
  const res = await GET(new Request(`${url}?value=${encodeURIComponent(value)}`));
  return { status: res.status, body: await res.json() };
}

// ═══ LE RETRAIT ══════════════════════════════════════════════════════════

describe("S3.2/R — un match retiré ne conclut jamais", () => {
  for (const r of ROUTES) {
    it(`MUTANT — ${r.nom} : trouvé puis retiré → NO_MATCH_PARTIAL`, async () => {
      lookupMock.mockResolvedValue(SIGNAL_TROUVE);
      matchMock.mockResolvedValue(SIGNAL_TROUVE);
      // La gate : aucune entité `RETAIL_SAFE` pour cette valeur.
      entiteMock.mockResolvedValue({ displaySafety: "INTERNAL_ONLY" });

      const { status, body } = await servir(r.mod, r.url, TEMOIN);
      expect(status).toBe(200);
      expect(body.sanctionAssessment, `${r.nom} conclut sur un retrait`).toBe("NO_MATCH_PARTIAL");
      expect(body.sanctionAssessment).not.toBe("NO_MATCH_COMPLETE");
      expect(body.sanctionsCoverage.negativeIsConclusive).toBe(false);
      expect(body.sanctionsCoverage.state).toBe("PARTIAL");
    });

    it(`MUTANT — ${r.nom} : le retrait ne DIVULGUE rien`, async () => {
      lookupMock.mockResolvedValue(SIGNAL_TROUVE);
      matchMock.mockResolvedValue(SIGNAL_TROUVE);
      entiteMock.mockResolvedValue({ displaySafety: "INTERNAL_ONLY" });

      const { body } = await servir(r.mod, r.url, TEMOIN);
      // Le booléen NE CHANGE PAS : révéler la sanction serait divulguer ce que
      // la gate protège. C'est la CONCLUSION qui cesse, pas le secret.
      expect(body.hasSanction).toBe(false);
      expect(body.match).toBe(false);
      expect(body.matchCount).toBe(0);
      // ██ AUCUN champ n'apparaît sur retrait — l'oracle énumérable.
      //
      // `ofac` n'est PAS une fuite : il vient de la liste des COLLECTEURS,
      // servie à l'identique dans toutes les réponses. Ma première version
      // l'interdisait et mesurait donc la mauvaise chose. Ce qui serait une
      // fuite, c'est la classe de risque du match retiré, sa source
      // gagnante, ou l'état de publication lui-même.
      const brut = JSON.stringify(body);
      for (const fuite of ["WITHHELD", "publicationState", "SANCTION", "EXACT"]) {
        expect(brut, `${r.nom} fuite : ${fuite}`).not.toContain(fuite);
      }

      // ██ LA PROPRIÉTÉ QUI COMPTE : la charge utile du retrait a EXACTEMENT
      // les mêmes clefs que celle d'une absence vraie. Un champ qui
      // n'apparaîtrait que sur suppression serait une déclaration.
      lookupMock.mockResolvedValue(SIGNAL_VIDE);
      matchMock.mockResolvedValue(SIGNAL_VIDE);
      entiteMock.mockResolvedValue(null);
      const { body: vrai } = await servir(r.mod, r.url, "0x05");
      expect(Object.keys(body).sort(), `${r.nom} : clefs divergentes`).toEqual(
        Object.keys(vrai).sort(),
      );
      expect(Object.keys(body.sanctionsCoverage).sort()).toEqual(
        Object.keys(vrai.sanctionsCoverage).sort(),
      );
      // Et les valeurs ne diffèrent QUE sur la conclusion — jamais sur le
      // détail des collecteurs, qui reste vrai et identique.
      expect(body.sanctionsCoverage.expected).toEqual(vrai.sanctionsCoverage.expected);
      expect(body.sanctionsCoverage.notConsulted).toEqual(vrai.sanctionsCoverage.notConsulted);
      expect(body.sanctionsCoverage.declaredNotArmed).toEqual(
        vrai.sanctionsCoverage.declaredNotArmed,
      );
    });

    it(`SUR-CORRECTION — ${r.nom} : une absence VRAIE garde son négatif concluant`, async () => {
      // Le piège symétrique. Si toute absence devenait non concluante, on
      // aurait remplacé une fausse réassurance par un WARN permanent.
      lookupMock.mockResolvedValue(SIGNAL_VIDE);
      matchMock.mockResolvedValue(SIGNAL_VIDE);
      entiteMock.mockResolvedValue(null);

      const { body } = await servir(r.mod, r.url, "0x000000000000000000000000000000000000dEaD");
      expect(body.sanctionAssessment).toBe("NO_MATCH_COMPLETE");
      expect(body.sanctionsCoverage.negativeIsConclusive).toBe(true);
      expect(body.sanctionsCoverage.state).toBe("COMPLETE");
    });

    it(`MUTANT — ${r.nom} : un retrait décidé à l'étage MATCHER voyage aussi`, async () => {
      // Le matcher peut retirer de son côté (refus de NIVEAU ENTITÉ). Le
      // signal porte alors `WITHHELD` avec `matchCount: 0` : la route ne passe
      // PAS par sa propre gate, et doit quand même cesser d'affirmer.
      const retireAuMatcher = { ...SIGNAL_VIDE, publicationState: "WITHHELD" };
      lookupMock.mockResolvedValue(retireAuMatcher);
      matchMock.mockResolvedValue(retireAuMatcher);
      entiteMock.mockResolvedValue(null);

      const { body } = await servir(r.mod, r.url, "0x04");
      expect(body.sanctionAssessment).toBe("NO_MATCH_PARTIAL");
      expect(body.sanctionsCoverage.negativeIsConclusive).toBe(false);
      expect(JSON.stringify(body)).not.toContain("WITHHELD");
    });

    it(`SUR-CORRECTION — ${r.nom} : un match ADMISSIBLE sort toujours`, async () => {
      lookupMock.mockResolvedValue(SIGNAL_TROUVE);
      matchMock.mockResolvedValue(SIGNAL_TROUVE);
      entiteMock.mockResolvedValue({ displaySafety: "RETAIL_SAFE" });

      const { body } = await servir(r.mod, r.url, TEMOIN);
      expect(body.match).toBe(true);
      expect(body.hasSanction).toBe(true);
      expect(body.sanctionAssessment).toBe("MATCHED");
    });
  }
});
