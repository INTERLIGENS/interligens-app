import type { Locale } from './types'

type RefusalKey =
  | 'should_i_buy'
  | 'price_prediction'
  | 'team_info'
  | 'legal_advice'
  | 'token_compare'
  | 'generic'

const REFUSALS: Record<RefusalKey, Record<Locale, string>> = {
  should_i_buy: {
    en: 'INTERLIGENS does not provide investment advice. The scan result is a risk signal only.',
    fr: 'INTERLIGENS ne fournit pas de conseils en investissement. Le résultat du scan est uniquement un signal de risque.',
  },
  price_prediction: {
    en: 'Price prediction is outside the scope of this scan. INTERLIGENS analyses risk signals, not market movements.',
    fr: "La prédiction de prix est hors du périmètre de ce scan. INTERLIGENS analyse les signaux de risque, pas les mouvements de marché.",
  },
  team_info: {
    en: 'Team identity information is not available in this scan.',
    fr: "Les informations sur l'identité de l'équipe ne sont pas disponibles dans ce scan.",
  },
  legal_advice: {
    en: 'INTERLIGENS does not provide legal advice. Consult a qualified professional for legal matters.',
    fr: 'INTERLIGENS ne fournit pas de conseils juridiques. Consultez un professionnel qualifié pour les questions légales.',
  },
  token_compare: {
    en: 'Multi-token comparison is not available in this view.',
    fr: "La comparaison multi-token n'est pas disponible dans cette vue.",
  },
  generic: {
    en: 'This question is outside the scope of the current scan explanation.',
    fr: "Cette question est hors du périmètre de l'explication du scan actuel.",
  },
}

export function getRefusal(key: RefusalKey, locale: Locale): string {
  return REFUSALS[key]?.[locale] ?? REFUSALS.generic[locale]
}
