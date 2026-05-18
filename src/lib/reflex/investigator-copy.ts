/**
 * REFLEX V1 — investigator UI copy (EN + FR).
 *
 * Same lint-checked pattern as admin-copy.ts. Every string lives here so
 * investigator-copy.test.ts can run assertClean() over the full surface.
 */

export const INVESTIGATOR_COPY = {
  en: {
    pageTitle: "REFLEX — investigator shadow workspace",
    pageSubtitle: "Browse persisted analyses. Filters update the URL; reload to refresh.",
    backLink: "Back to investigator hub",

    filters: {
      verdict: "Verdict",
      mode: "Mode",
      window: "Window",
      fp: "False-positive",
      all: "All",
      flagged: "Flagged",
      unflagged: "Unflagged",
      apply: "Apply",
      reset: "Reset",
    },

    table: {
      id: "ID",
      createdAt: "Created (UTC)",
      inputType: "Input type",
      input: "Input",
      verdict: "Verdict",
      confidence: "Confidence",
      latency: "Latency (ms)",
      mode: "Mode",
      fp: "FP",
      open: "Open",
    },

    empty: {
      noResults: "No analyses match these filters in the selected window.",
      noCrossRefs: "No cross-references found for this input.",
    },

    pagination: {
      previous: "Previous",
      next: "Next",
      pageOf: "Page {page} of {total}",
    },

    detail: {
      heading: "Analysis detail",
      input: "Input",
      verdict: "Verdict",
      reasons: "Reasons",
      reasonsEn: "Reasons (EN)",
      reasonsFr: "Reasons (FR)",
      action: "Action",
      actionEn: "Action (EN)",
      actionFr: "Action (FR)",
      confidence: "Confidence",
      crossReferences: "Cross-references",
      kolProfile: "KOL profile",
      caseFiles: "Linked casefiles",
      manifest: "Signals manifest",
      manifestHint: "Click to expand the full engines manifest (JSON).",
      audit: "Audit",
      signalsHash: "Signals hash",
      enginesVersion: "Engines version",
      latencyMs: "Latency",
      mode: "Mode",
      fpStatus: "False-positive status",
      fpFlagged: "Flagged as false positive",
      fpUnflagged: "Not flagged",
      notFound: "This analysis ID does not exist or has been redacted.",
    },
  },

  fr: {
    pageTitle: "REFLEX — espace shadow investigateur",
    pageSubtitle: "Parcourir les analyses persistées. Les filtres mettent à jour l'URL; recharger pour rafraîchir.",
    backLink: "Retour à l'espace investigateur",

    filters: {
      verdict: "Verdict",
      mode: "Mode",
      window: "Fenêtre",
      fp: "Faux positifs",
      all: "Tous",
      flagged: "Flaggés",
      unflagged: "Non flaggés",
      apply: "Appliquer",
      reset: "Réinitialiser",
    },

    table: {
      id: "ID",
      createdAt: "Créé (UTC)",
      inputType: "Type d'entrée",
      input: "Entrée",
      verdict: "Verdict",
      confidence: "Confiance",
      latency: "Latence (ms)",
      mode: "Mode",
      fp: "FP",
      open: "Ouvrir",
    },

    empty: {
      noResults: "Aucune analyse ne correspond à ces filtres dans la fenêtre sélectionnée.",
      noCrossRefs: "Aucune référence croisée trouvée pour cette entrée.",
    },

    pagination: {
      previous: "Précédent",
      next: "Suivant",
      pageOf: "Page {page} sur {total}",
    },

    detail: {
      heading: "Détail de l'analyse",
      input: "Entrée",
      verdict: "Verdict",
      reasons: "Raisons",
      reasonsEn: "Raisons (EN)",
      reasonsFr: "Raisons (FR)",
      action: "Action",
      actionEn: "Action (EN)",
      actionFr: "Action (FR)",
      confidence: "Confiance",
      crossReferences: "Références croisées",
      kolProfile: "Profil KOL",
      caseFiles: "Dossiers liés",
      manifest: "Manifest des signaux",
      manifestHint: "Cliquer pour déplier le manifest complet (JSON).",
      audit: "Audit",
      signalsHash: "Hash des signaux",
      enginesVersion: "Version des moteurs",
      latencyMs: "Latence",
      mode: "Mode",
      fpStatus: "Statut faux positif",
      fpFlagged: "Flaggé comme faux positif",
      fpUnflagged: "Non flaggé",
      notFound: "Cet ID d'analyse n'existe pas ou a été redacté.",
    },
  },
};
// NOTE: no `as const` here on purpose. With `as const`, every nested
// string would be its own literal type, so `typeof INVESTIGATOR_COPY.en`
// and `.fr` would not be assignable to each other — copyFor()'s return
// type would reject the FR branch. Inferring `string` for the leaves
// keeps both locales structurally identical without losing the narrow
// "en" | "fr" inference of the top-level keys (keyof typeof works
// regardless of `as const`).

export type InvestigatorLocale = keyof typeof INVESTIGATOR_COPY;

export function copyFor(locale: InvestigatorLocale): typeof INVESTIGATOR_COPY.en {
  return INVESTIGATOR_COPY[locale];
}
