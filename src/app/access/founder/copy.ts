// Copy for /access/founder, both locales. Wording is locked by the brief —
// do not paraphrase. "abonnement", "guaranteed", "risk-free" etc. are
// forbidden anywhere on this page.

export type FounderLocale = "en" | "fr";

export const FOUNDER_COPY: Record<FounderLocale, {
  title: string;
  price: string;
  cap: string;
  copy: string;
  trust: string;
  cta: string;
  emailLabel: string;
  emailPlaceholder: string;
  footer: string;
  langToggle: string;
  emailInvalid: string;
  submitting: string;
  serverError: string;
  rateLimited: string;
  turnstileFailed: string;
  soldOutTitle: string;
  soldOutBody: string;
  waitlistCta: string;
  waitlistThanks: string;
}> = {
  en: {
    title: "Beta Founder Access",
    price: "1 €",
    cap: "10,000 beta accesses",
    copy: "Your 1 € contribution helps fund API costs, infrastructure and investigation tooling during the private beta.",
    trust: "INTERLIGENS never stores your card details. Payments are processed securely by Stripe, Apple Pay or Google Pay.",
    cta: "Unlock beta access — 1 €",
    emailLabel: "Email address",
    emailPlaceholder: "you@domain.com",
    footer: "Evidence-based. Not financial advice.",
    langToggle: "FR",
    emailInvalid: "Please enter a valid email address.",
    submitting: "Preparing secure checkout…",
    serverError: "Checkout could not start. Try again in a few seconds.",
    rateLimited: "Too many attempts. Please retry later.",
    turnstileFailed: "Anti-bot check failed. Reload and try again.",
    soldOutTitle: "Sold out",
    soldOutBody: "All 10,000 beta accesses have been claimed. Join the waitlist to be notified when more open up.",
    waitlistCta: "Join waitlist",
    waitlistThanks: "You're on the waitlist. We'll email you if a slot opens.",
  },
  fr: {
    title: "Accès Bêta Fondateur",
    price: "1 €",
    cap: "10 000 accès bêta",
    copy: "Votre contribution de 1 € aide à financer les API, l'infrastructure et les outils d'investigation pendant la bêta privée.",
    trust: "INTERLIGENS ne stocke jamais vos coordonnées bancaires. Le paiement est traité de manière sécurisée par Stripe, Apple Pay ou Google Pay.",
    cta: "Débloquer l'accès bêta — 1 €",
    emailLabel: "Adresse email",
    emailPlaceholder: "vous@domaine.com",
    footer: "Basé sur des preuves. Pas un conseil financier.",
    langToggle: "EN",
    emailInvalid: "Veuillez saisir une adresse email valide.",
    submitting: "Préparation du paiement sécurisé…",
    serverError: "Impossible d'ouvrir le paiement. Réessayez dans quelques secondes.",
    rateLimited: "Trop de tentatives. Réessayez plus tard.",
    turnstileFailed: "Vérification anti-bot échouée. Rechargez la page et réessayez.",
    soldOutTitle: "Complet",
    soldOutBody: "Les 10 000 accès bêta ont été distribués. Inscrivez-vous sur la liste d'attente pour être prévenu si de nouvelles places s'ouvrent.",
    waitlistCta: "Rejoindre la liste d'attente",
    waitlistThanks: "Vous êtes sur la liste d'attente. Nous vous écrirons si une place se libère.",
  },
};

export function detectLocaleFromHeader(acceptLanguage: string | null | undefined): FounderLocale {
  if (!acceptLanguage) return "en";
  const lower = acceptLanguage.toLowerCase();
  const enIndex = lower.indexOf("en");
  const frIndex = lower.indexOf("fr");
  if (frIndex !== -1 && (enIndex === -1 || frIndex < enIndex)) return "fr";
  return "en";
}
