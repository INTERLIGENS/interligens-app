// src/app/api/watchlist/route.ts
import { admettreAnonyme, repondre } from '@/lib/governance/audienceProjection'
import { projeterWatchlist } from '@/lib/governance/surfaces/watchlist'

export const dynamic = 'force-dynamic'

export async function GET() {
  // COLLECTION AUTHORITY — l'appartenance à la Watchlist est elle-même une
  // assertion publiée, et aucune décision ne la fonde. Le refus est au niveau
  // de la COLLECTION : il ne porte ni compte, ni longueur, ni clé par membre,
  // ni ordre — les six différentiels mesurés ne peuvent plus rien reconstruire.
  //
  // AUCUNE DONNÉE N'EST DÉTRUITE. handlesV2 garde ses 108 entrées, la base
  // garde ses lignes, le cron garde sa source de vérité. C'est l'ÉMISSION qui
  // s'arrête. La Watchlist reste un outil interne d'enquête.
  //
  // Ce qui rend le retrait CAUSAL : rebrancher la route demain ne suffit pas à
  // faire repartir le contenu. `projeterWatchlist` lève si la table des
  // fondations déclarait une décision d'appartenance, et `repondre` n'accepte
  // rien d'autre qu'un `Admissible`.
  const admission = admettreAnonyme(
    "watchlist retiree de la projection servie — voir docs/reports/build12-p0-published-content-authority.md §6.2",
  )
  return repondre(projeterWatchlist(admission, []))
}
