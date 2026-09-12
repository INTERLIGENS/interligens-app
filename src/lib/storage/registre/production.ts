// ─── E-RC · LEASE A — LA PRODUCTION GOUVERNÉE, FAIL-CLOSED ───────────────
//
// ██  "No registry authority → no governed artifact production             ██
// ██   OR DELIVERY."                                                       ██
//
// ─── POURQUOI CETTE PRIMITIVE EXISTE ─────────────────────────────────────
//
// La décision « produit-on, ou refuse-t-on ? » vivait dans la route, sous la
// forme d'un `if (isStorageEnabled())` suivi d'un repli. Trois chemins y
// menaient au MÊME résultat — un PDF servi en flux direct, hors registre :
//
//   1. `PDF_STORAGE_ENABLED` absent  → le bloc entier était sauté ;
//   2. `upload === null`             → « R2 down → fallback stream direct » ;
//   3. le commentaire « comportement original », qui rejoignait les deux.
//
// UNE VARIABLE D'ENVIRONNEMENT PEUT CONFIGURER L'INFRASTRUCTURE ; ELLE NE
// PEUT PAS TRANSFORMER UN ARTEFACT GOUVERNÉ EN ARTEFACT HORS REGISTRE.
// `isStorageEnabled()` ne décide donc plus si l'autorité existe : il est lu
// ICI, et son absence est un REFUS, pas un contournement.
//
// La décision est dans une primitive et non dans la route pour la raison qui
// a déjà tranché l'emplacement du gate : une garde posée dans une route ne
// protège pas la deuxième route, celle qui n'est pas écrite. Le chemin gelé
// n'a plus qu'à APPELER et à RENDRE le refus — il n'a plus de décision à
// porter, donc plus de décision à perdre.
import { isStorageEnabled, uploadPdf, ErreurStockageGouverne } from "../pdfStorage";
import { ErreurRegistre } from "./registre";
import { DOCTRINE } from "./contrat";
import type { PdfUploadInput } from "../types";

/**
 * Les raisons de NE PAS produire. Domaine FERMÉ, et chacune est nommée : un
 * refus anonyme est indiscernable d'une panne, et c'est la leçon des quatre
 * 401 du lot F — identiques au statut, venus de deux couches différentes.
 */
export type RaisonDeRefusProduction =
  /** Le stockage gouverné n'est pas disponible. AUCUN objet n'a été écrit. */
  | "STOCKAGE_GOUVERNE_INDISPONIBLE"
  /** L'allocation a échoué. AUCUN objet n'a été écrit — D5 tient par construction. */
  | "REGISTRE_INDISPONIBLE"
  /** Le PutObject a échoué. Une ligne INTENDED subsiste, réconciliable. */
  | "ECRITURE_OBJET_IMPOSSIBLE"
  /** L'objet EXISTE, sa clé est connue, l'enregistrement n'a pas abouti. */
  | "ENREGISTREMENT_IMPOSSIBLE";

export type ResultatProduction =
  | {
      readonly produit: true;
      readonly key: string;
      readonly signedUrl: string;
      readonly sha256: string;
      readonly sizeBytes: number;
      readonly registreId: string;
    }
  | {
      readonly produit: false;
      readonly raison: RaisonDeRefusProduction;
      readonly explication: string;
      /**
       * 503, jamais 500. L'autorité est INDISPONIBLE ; la génération, elle,
       * a réussi — le PDF a été rendu. Annoncer « PDF generation failed »
       * enverrait chercher au mauvais endroit.
       */
      readonly statutHttp: 503;
    };

const REFUS = (raison: RaisonDeRefusProduction, explication: string): ResultatProduction => ({
  produit: false,
  raison,
  explication,
  statutHttp: 503,
});

/**
 * Produire un artefact gouverné — ou REFUSER, nommément.
 *
 * ⚠️ IL N'EXISTE AUCUN CHEMIN DE SORTIE QUI RENDE LES OCTETS SANS LES AVOIR
 * ENREGISTRÉS. C'est la propriété entière de cette fonction : son type de
 * retour ne porte pas de variante « voici le PDF, mais hors registre ». Un
 * appelant ne peut donc pas se tromper en la lisant mal — la variante
 * n'existe pas.
 *
 * Ce qui n'est PAS attrapé ici, et qui doit continuer de lever : le garde de
 * taille (`PDF exceeds max size`). Un PDF de 30 Mo est un échec de
 * GÉNÉRATION, pas d'autorité ; le confondre avec une indisponibilité de
 * registre ferait rendre 503 là où 500 est la vérité.
 */
export async function produireArtefactGouverne(
  input: PdfUploadInput,
): Promise<ResultatProduction> {
  if (!isStorageEnabled()) {
    return REFUS(
      "STOCKAGE_GOUVERNE_INDISPONIBLE",
      "Le stockage gouverné n'est pas disponible. Aucun artefact n'est produit " +
        "hors registre : une variable d'environnement configure l'infrastructure, " +
        "elle ne décide pas si l'autorité existe. " +
        DOCTRINE.AUTORITE_OU_RIEN,
    );
  }

  try {
    const upload = await uploadPdf(input);
    return {
      produit: true,
      key: upload.key,
      signedUrl: upload.signedUrl,
      sha256: upload.sha256,
      sizeBytes: upload.sizeBytes,
      registreId: upload.registreId,
    };
  } catch (err) {
    if (err instanceof ErreurStockageGouverne) {
      switch (err.code) {
        case "STOCKAGE_DESACTIVE":
          return REFUS("STOCKAGE_GOUVERNE_INDISPONIBLE", err.message);
        case "PUT_ECHOUE":
          return REFUS(
            "ECRITURE_OBJET_IMPOSSIBLE",
            `${err.message} — une ligne INTENDED subsiste pour ${err.cle}, ` +
              "l'échec est réconciliable.",
          );
        case "CONFIRMATION_ECHOUEE":
          return REFUS(
            "ENREGISTREMENT_IMPOSSIBLE",
            `${err.message} — l'objet ${err.cle} EXISTE et sa clé est connue ; ` +
              "la ligne reste INTENDED, donc réconciliable. L'artefact n'est pas " +
              "publiable tant que l'opération gouvernée n'est pas close.",
          );
      }
    }
    if (err instanceof ErreurRegistre) {
      // Aucun PutObject n'a été tenté : l'allocation précède les octets.
      return REFUS(
        "REGISTRE_INDISPONIBLE",
        `${err.message} — aucun objet n'a été écrit. ` + DOCTRINE.AUTORITE_OU_RIEN,
      );
    }
    // Tout le reste est un échec de génération, et le reste.
    throw err;
  }
}
