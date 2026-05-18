/**
 * Contact addresses — single source of truth.
 *
 * The public surface uses exactly three working addresses:
 *  - CONTACT_EMAIL       general correspondence, residual contact
 *  - LEGAL_EMAIL         takedown filings, LCEN notices, legal correspondence
 *  - PARTNERSHIPS_EMAIL  press, partners / enterprise, Guard early access, B2B
 *
 * Per-page mailto subjects stay specific to each page; only the address
 * is centralised here. Addresses are mailto-only — no form posts anywhere.
 */

export const CONTACT_EMAIL = "contact@interligens.com";
export const LEGAL_EMAIL = "legal@interligens.com";
export const PARTNERSHIPS_EMAIL = "partnerships@interligens.com";
