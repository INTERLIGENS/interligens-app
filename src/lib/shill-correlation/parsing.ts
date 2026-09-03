// --- Parseurs de colonnes brutes — module PUR -----------------------------
//
// Ces fonctions lisent des colonnes dont le TYPE DECLARE et le TYPE REEL
// different : `detectedTokens` est jsonb en base mais `String` au schema
// Prisma, `detectedAddresses` et `signalTypes` sont du texte contenant du JSON.
// Le client pooled de production coerce l'un en chaine, pas l'autre.
//
// Elles vivaient dans ingest.ts, qui importe prisma. Tout consommateur du
// parseur importait donc le client de base pour lire un tableau — c'est ce que
// ce module ferme. Rien ici n'ouvre de connexion, ne touche au reseau, ni
// n'ecrit quoi que ce soit.

/**
 * Parse the detectedTokens column. Stored as JSON text but jsonb-coerced to a
 * String by the pooled prod client (see api/cron/watcher-v2/route.ts), so we
 * accept either a JSON string or an already-parsed array, and tolerate either
 * bare-string mints or { mint } / { address } objects.
 */
export function parseDetectedTokens(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t === "string" ? t : t?.mint ?? t?.address ?? ""))
      .map((t) => String(t).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
