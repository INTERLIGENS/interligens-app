/**
 * Shared client-facing display strings for the investigator vault.
 *
 * Centralised so every decrypt failure, loading state and empty state shows
 * the same phrasing — makes localisation, copy tweaks and user-support
 * scripts much easier.
 */

/** Shown when an encrypted field can't be decrypted with the current key. */
export const UNREADABLE_LABEL = "Encrypted — lock & retry with correct passphrase";

/** Compact variant for search dropdowns and tight spaces. */
export const UNREADABLE_LABEL_SHORT = "Encrypted";

/** Loading placeholder for encrypted fields that have not arrived yet. */
export const DECRYPTING_LABEL = "Decrypting…";
