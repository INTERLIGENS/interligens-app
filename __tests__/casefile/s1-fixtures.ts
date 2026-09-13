// Identités partagées par les témoins S1. Reprises des constantes du produit
// pour que les tests rougissent si l'identité d'un dossier change.
import { VINE_MINT as VINE, BOTIFY_CASEFILE_REF } from "@/lib/casefile/publicProjection";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";

export const VINE_MINT = VINE;
export const BOTIFY_MINT_FOR_TEST = BOTIFY_MINT;
export const BOTIFY_REF = BOTIFY_CASEFILE_REF;
