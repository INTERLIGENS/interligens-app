/**
 * Casefile Engine V1 — jurisdictional flags.
 *
 * Key V1 distinction: reporting language is NOT the same as jurisdiction.
 * `reportingLanguage === 'fr'` means the reporter wrote in French — they can
 * still be physically located in BE, CA-QC, CH, LU, SN, etc. Conflating the
 * two would route a Belgian draft to French police templates, which is wrong.
 *
 * Touchpoints we track in V1 because they recur in crypto-recovery context:
 *   - UK : civil disclosure orders, Bankers Trust, Norwich Pharmacal
 *   - SG : SGHC asset-tracing case law (CLM v CLN)
 *   - HK : HKCFI freezing relief
 *   - UAE: VARA / Dubai courts
 *   - US : DOJ/FBI ic3.gov channel
 *
 * Implementation note: this file was authored from the audit test description
 * (FR ≠ francophone, touchpoints UK/SG/HK/UAE/US). The PROMPT marker
 * "comme dans le draft précédent" did not include the draft itself.
 */

export const TOUCHPOINT_JURISDICTIONS = ["UK", "SG", "HK", "UAE", "US"] as const;
export type TouchpointJurisdiction = (typeof TOUCHPOINT_JURISDICTIONS)[number];

// ISO-3166 alpha-2 countries where French is an official / co-official language
// for the purpose of routing reporting templates. NOT exhaustive — V1 tight set.
const FRANCOPHONE_COUNTRIES = new Set([
  "FR", "BE", "CH", "LU", "MC",
  "CA", "QC", // Canada at large + Quebec sub-region tag occasionally seen in intake
  "SN", "CI", "ML", "BF", "NE", "TG", "BJ", "CM", "GA", "CG", "CD", "DJ",
]);

export interface JurisdictionalFlagsInput {
  reportingCountry?: string;
  reportingLanguage?: string;
  cexTouchpointDetected?: unknown;
  domains?: unknown;
}

export interface JurisdictionalFlags {
  reportingCountry: string | null;
  reportingLanguage: string | null;
  reportingCountryIsFrance: boolean;
  reportingLanguageIsFrench: boolean;
  francophoneCountry: boolean;
  // True when the reporter writes in French but reports from a non-FR country.
  // Used to surface "do not auto-route to French police template" warning.
  francophoneNonFrance: boolean;
  touchpoints: Record<TouchpointJurisdiction, boolean>;
  touchpointList: TouchpointJurisdiction[];
  notes: string[];
}

function normaliseIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return v.length === 0 ? null : v;
}

function extractCexJurisdictions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const j = (item as { jurisdiction?: unknown }).jurisdiction;
      const norm = normaliseIso(j);
      if (norm) out.push(norm);
    }
  }
  return out;
}

function extractDomainJurisdictions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const hosting = normaliseIso(
        (item as { hostingCountry?: unknown }).hostingCountry,
      );
      if (hosting) out.push(hosting);
      const tld = (item as { tld?: unknown }).tld;
      if (typeof tld === "string") {
        const t = tld.trim().toLowerCase().replace(/^\./, "");
        if (t === "uk" || t === "co.uk") out.push("UK");
        else if (t === "sg") out.push("SG");
        else if (t === "hk") out.push("HK");
        else if (t === "ae") out.push("UAE");
        else if (t === "us") out.push("US");
      }
    }
  }
  return out;
}

export function computeJurisdictionalFlags(
  input: JurisdictionalFlagsInput,
): JurisdictionalFlags {
  const reportingCountry = normaliseIso(input.reportingCountry);
  const reportingLanguage = (() => {
    if (typeof input.reportingLanguage !== "string") return null;
    const v = input.reportingLanguage.trim().toLowerCase();
    return v.length === 0 ? null : v;
  })();

  const reportingCountryIsFrance = reportingCountry === "FR";
  const reportingLanguageIsFrench = reportingLanguage === "fr";
  const francophoneCountry =
    reportingCountry !== null && FRANCOPHONE_COUNTRIES.has(reportingCountry);
  const francophoneNonFrance =
    reportingLanguageIsFrench && reportingCountry !== null && reportingCountry !== "FR";

  // Collect touchpoint jurisdictions across CEX and domains.
  const collected = new Set<string>([
    ...extractCexJurisdictions(input.cexTouchpointDetected),
    ...extractDomainJurisdictions(input.domains),
  ]);

  const touchpoints: Record<TouchpointJurisdiction, boolean> = {
    UK: false,
    SG: false,
    HK: false,
    UAE: false,
    US: false,
  };
  for (const j of TOUCHPOINT_JURISDICTIONS) {
    if (collected.has(j)) touchpoints[j] = true;
  }
  const touchpointList = TOUCHPOINT_JURISDICTIONS.filter((j) => touchpoints[j]);

  const notes: string[] = [];
  if (francophoneNonFrance) {
    notes.push(
      "Reporting language is French but reporting country is not FR — do not auto-route to French police template.",
    );
  }
  if (touchpointList.length > 0) {
    notes.push(
      `Touchpoint jurisdictions detected: ${touchpointList.join(", ")} — counsel may consider civil disclosure routes (V1: informational only).`,
    );
  }

  return {
    reportingCountry,
    reportingLanguage,
    reportingCountryIsFrance,
    reportingLanguageIsFrench,
    francophoneCountry,
    francophoneNonFrance,
    touchpoints,
    touchpointList,
    notes,
  };
}
