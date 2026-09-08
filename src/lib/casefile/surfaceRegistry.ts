// ─── BUILD 10 · P3 — LE REGISTRE DES SURFACES CASEFILE ─────────────────────
//
// ██  Ce qui n'est pas déclaré ici échappe aux gates. C'est tout le point.  ██
//
// ─── Pourquoi ce fichier existe ───────────────────────────────────────────
//
// BUILD 9 a supprimé deux autorités CaseFile concurrentes. BUILD 10 en a
// trouvé une TROISIÈME — `/en/cases/botify/evidence` — publique, portant ses
// propres claims en dur, rendant `CONFIRMED` ce que l'autorité porte en
// `ATTACHED`, publiant le mint synthétique et employant un mot interdit par
// le contrat de wording.
//
// Elle n'a pas échappé aux gates par malice ni par négligence : elle a échappé
// parce qu'elle n'était **dans aucune carte**. Les gates s'appliquaient aux
// surfaces connues, et personne ne tenait la liste des surfaces.
//
// Ce registre est cette liste. Il ne vérifie rien tout seul — c'est
// `__tests__/casefile/surface-registry.test.ts` qui refuse toute surface
// non déclarée. Le registre est la déclaration, le test est la garde.
//
// ─── Comment ajouter une surface ──────────────────────────────────────────
//
// On ne l'ajoute pas pour faire passer un test. On l'ajoute quand une surface
// publie du matériel de dossier, et on renseigne HONNÊTEMENT son autorité :
//
//   CANONICAL   elle lit `token_casefiles` / `CaseFileClaim` / `CaseFileSource`
//               via `canonicalReader` ou `publicProjection`
//   PRESET      elle lit `presets.ts` — vestige, admin uniquement
//   NONE        elle ne publie aucun matériel de dossier
//
// Déclarer `CANONICAL` une surface qui ne l'est pas ne trompe que la
// prochaine personne qui lira ce fichier.

export const SURFACE_AUTHORITIES = ["CANONICAL", "PRESET", "NONE"] as const;
export type SurfaceAuthority = (typeof SURFACE_AUTHORITIES)[number];

export interface CaseFileSurface {
  /** Chemin du fichier, depuis la racine du dépôt. */
  readonly file: string;
  /** Ce que le public voit, ou `null` pour une surface admin. */
  readonly route: string | null;
  readonly authority: SurfaceAuthority;
  /** `true` si elle est atteignable sans authentification admin. */
  readonly public: boolean;
  /** Pourquoi elle est là, en une ligne. */
  readonly note: string;
}

/**
 * Toute surface qui publie du matériel de dossier.
 *
 * L'ordre est celui de la carte S0 : ce qu'un lecteur Investor/Counsel ouvre
 * en premier vient en premier.
 */
export const CASEFILE_SURFACES: readonly CaseFileSurface[] = [
  {
    file: "src/app/en/cases/lab/page.tsx",
    route: "/en/cases/lab",
    authority: "CANONICAL",
    public: true,
    note: "Fiche LAB — ligne token_casefiles + projection canonique (BUILD 9 / étape 5).",
  },
  {
    file: "src/app/fr/cases/lab/page.tsx",
    route: "/fr/cases/lab",
    authority: "CANONICAL",
    public: true,
    note: "Miroir français de la fiche LAB.",
  },
  {
    file: "src/app/en/cases/cbex/page.tsx",
    route: "/en/cases/cbex",
    authority: "CANONICAL",
    public: true,
    note: "Fiche CBEX — platformCaseFile, filtrée sur publishStatus.",
  },
  {
    file: "src/app/fr/cases/cbex/page.tsx",
    route: "/fr/cases/cbex",
    authority: "CANONICAL",
    public: true,
    note: "Miroir français de la fiche CBEX.",
  },
  {
    file: "src/app/en/cases/botify/evidence/page.tsx",
    route: "/en/cases/botify/evidence",
    authority: "CANONICAL",
    public: true,
    note:
      "TROISIÈME AUTORITÉ trouvée en BUILD 10 / S0, fermée en P3. Portait 8 claims " +
      "en dur rendus CONFIRMED, 15 wallets, le mint synthétique et « rug-pull ». " +
      "Lit désormais la projection canonique.",
  },
  {
    file: "src/app/en/cases/page.tsx",
    route: "/en/cases",
    authority: "CANONICAL",
    public: true,
    note: "Index des dossiers — tokenCaseFile + platformCaseFile, filtrés sur publishStatus.",
  },
  {
    file: "src/app/fr/cases/page.tsx",
    route: "/fr/cases",
    authority: "CANONICAL",
    public: true,
    note:
      "Miroir français de l'index. NOTE BUILD 10 : il pointe vers /fr/cases/botify, " +
      "qui N'EXISTE PAS — seule la locale `en` porte cette page. Constaté, non corrigé " +
      "en P3 : créer une page fr est une décision de publication.",
  },
  {
    file: "src/app/api/casefile/public/route.ts",
    route: "/api/casefile/public",
    authority: "CANONICAL",
    public: true,
    note: "PDF retail — projection publique, fail-closed (BUILD 9 / étape 5).",
  },
  {
    file: "src/app/api/casefile/pdf/route.ts",
    route: "/api/casefile/pdf",
    authority: "CANONICAL",
    public: false,
    note: "PDF admin, deux gabarits ; claims canoniques pour les deux.",
  },
  {
    file: "src/app/api/casefile/route.ts",
    route: "/api/casefile",
    authority: "CANONICAL",
    public: false,
    note: "JSON admin — CASE_DB en ligne supprimée en BUILD 9 / étape 7.",
  },
  {
    file: "src/app/api/casefile/generate/route.ts",
    route: "/api/casefile/generate",
    authority: "CANONICAL",
    public: false,
    note:
      "Génération PDF admin. Claims canoniques pour source=botify|vine ; " +
      "`body.data` reste un utilitaire de rendu, et le rapport l'ANNONCE.",
  },
  {
    file: "src/app/api/admin/export/botify/route.ts",
    route: "/api/admin/export/botify",
    authority: "PRESET",
    public: false,
    note:
      "Export admin — lit ENCORE data/cases/botify.json. Trouvé par la garde du " +
      "registre, pas par une revue. Admin-only (requireAdminApi) et chemin GELÉ : " +
      "P3 le DÉCLARE, il ne le corrige pas.",
  },
  {
    file: "src/app/api/report/casefile/route.ts",
    route: "/api/report/casefile",
    authority: "PRESET",
    public: false,
    note:
      "Rapport admin — lit ENCORE data/cases/botify.json via require(). Même " +
      "constat, même statut : déclaré, non corrigé, chemin gelé.",
  },
];

/** Les surfaces publiques. Ce sont elles qui portent le risque forensic. */
export function publicSurfaces(): CaseFileSurface[] {
  return CASEFILE_SURFACES.filter((s) => s.public);
}

/** `true` si ce fichier est déclaré au registre. */
export function isDeclared(file: string): boolean {
  return CASEFILE_SURFACES.some((s) => s.file === file);
}
