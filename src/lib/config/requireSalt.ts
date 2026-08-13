// src/lib/config/requireSalt.ts
//
// UN SEL CRYPTOGRAPHIQUE N'A PAS DE REPLI.
//
// Le motif qu'on retire ici est `process.env.X || "un-littéral"`. Il a l'air
// défensif — il ne l'est pas. Le littéral vit dans le dépôt : il est PUBLIC.
// Un HMAC clé sur une valeur publique n'est plus un HMAC, c'est un hachage
// nu : l'adversaire précalcule la table et ré-identifie chaque adresse ou
// chaque IP « pseudonymisée ». Et comme le repli produit un hash de la bonne
// forme, rien ne se voit — ni exception, ni log, ni changement de comportement.
// Un sel absent doit être une PANNE, pas une dégradation muette.
//
// POURQUOI ÇA LÈVE À L'USAGE, JAMAIS À L'IMPORT.
// Un throw au niveau module s'exécute au chargement du bundle, donc pour tout
// le monde : une route qui ne hache rien tomberait à cause d'un sel qu'elle
// n'utilise pas, et sur Next.js l'erreur remonte au build ou au premier import
// froid, loin du site fautif. En levant dans la fonction, la panne est portée
// par la requête qui avait réellement besoin du sel, avec le nom de la
// variable dans le message.
//
// PAS D'EXCEPTION NODE_ENV ICI. Un `if (NODE_ENV !== "production") return
// "dev-salt"` réintroduirait exactement le repli qu'on retire, avec en prime
// le risque qu'un environnement mal étiqueté (preview, script, worker, run CI)
// se croie en droit de hacher sans sel. Les tests posent les sels dans
// l'environnement (`test.env` de vitest.config.ts), comme la Production les
// pose dans Vercel : une seule règle, partout.

/**
 * Lit un sel cryptographique dans l'environnement, ou lève.
 *
 * La chaîne vide vaut ABSENTE : `VAULT_AUDIT_SALT=""` est un provisionnement
 * raté, pas un sel. C'est le même angle mort que la famille `??` corrigée en
 * 185a99c/cc41f04 — sauf qu'ici il n'y a plus de repli du tout derrière.
 *
 * @param varName Nom de la variable d'environnement (apparaît dans l'erreur).
 * @throws {Error} si la variable est absente, vide, ou uniquement des blancs.
 */
export function requireSalt(varName: string): string {
  const raw = process.env[varName];
  if (raw === undefined || raw.trim() === "") {
    throw new Error(
      `[env] ${varName} absente ou vide — sel cryptographique requis, ` +
        `aucun repli possible. Poser la variable dans l'environnement ` +
        `(Vercel en Production, test.env de vitest.config.ts en test).`,
    );
  }
  // Retourné TEL QUEL, sans trim : le sel fait partie de la clé du HMAC.
  // Le normaliser changerait tous les hachages déjà écrits en base pour les
  // environnements dont le sel porte un blanc de bord.
  return raw;
}
