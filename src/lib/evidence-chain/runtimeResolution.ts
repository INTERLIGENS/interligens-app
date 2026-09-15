/**
 * LE CONSTRUCTEUR CANONIQUE DE LA RÉSOLUTION DE STOCKAGE.
 *
 * ██  UN SEUL ENDROIT ASSEMBLE LA CHAÎNE. IL N'Y EN A PAS DEUX.              ██
 *
 *   registre gouverné → autorité de localisation → résolution → ouvreur
 *
 * ─── LE DÉFAUT QUE CE FICHIER FERME (mesuré le 2026-09-15) ──────────────────
 *
 * L'autorité de localisation a été CONÇUE (`storageLocationJournal.ts`), le
 * pont a été LIVRÉ (`autoriteDuRegistreDeLocalisation`), et la table porte 31
 * événements `VERIFIED_BY_HEAD` réels. Les 31 pièces ont été démontrées
 * résolvables — mais par `mesure-de-fermeture.ts`, un INSTRUMENT DE MESURE qui
 * assemblait la chaîne lui-même.
 *
 * Le chemin de PRODUCTION, lui, ne consommait pas son autorité :
 *
 *     AUTORITES_DE_LOCALISATION = Object.freeze([])   storageResolution.ts
 *     stamp-pending.ts:93        resolveurGouverne()  ← ce défaut vide
 *     readback-verify.ts:58      resoudreLocalisation(p) ← ce défaut vide
 *
 * Les deux jobs prenaient donc un registre VIDE et refusaient les 31, pendant
 * qu'un script de mesure les résolvait toutes. L'instrument savait ce que le
 * chemin réel ignorait — c'est la définition d'une démonstration qui ne prouve
 * rien sur la production.
 *
 * ─── POURQUOI UN CONSTRUCTEUR, ET PAS UNE INJECTION PAR SCRIPT ──────────────
 *
 *   « Sinon nous aurons deux endroits capables de diverger demain. »
 *
 * Câbler l'autorité à la main dans `stamp-pending`, puis à la main dans
 * `readback-verify`, aurait fermé le défaut D'AUJOURD'HUI en en créant la
 * condition pour demain : deux assemblages, deux occasions d'oublier une
 * étape, et rien qui dise lequel fait foi. Il n'y a donc qu'une fonction, et
 * les consommateurs l'APPELLENT — ils n'en reproduisent pas le contenu.
 *
 * ⚠️ ET C'EST AUSSI CE QUI REND LE TÉMOIN VALIDE. Un test qui injecterait
 *    directement le registre dans `resoudreLocalisation` sans traverser ce
 *    constructeur ne mesurerait RIEN de la production : il éprouverait une
 *    chaîne qu'il a montée lui-même. Les témoins de ce module passent tous par
 *    `assemblerResolutionDeStockage`, et le mutant qui vide l'autorité ICI doit
 *    les faire rougir.
 *
 * ─── ⛔ CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────────
 *
 * Il n'écrit rien, ne lit aucun octet, et n'invente aucun compartiment. La
 * SEULE source d'un nom de compartiment reste une ligne du registre ; le
 * silence du registre reste un refus, mot pour mot celui d'avant.
 */
import {
  readStorageLocations,
  type StorageLocation,
  type StorageLocationRef,
  type StorageLocationSqlRunner,
} from "./storageLocationJournal";
import {
  autoriteDuRegistreDeLocalisation,
  resolveurGouverne,
  AUTORITES_DE_LOCALISATION,
  type AutoriteDeLocalisation,
  type ResolveStorageFn,
} from "./storageResolution";

/** Ce que le constructeur rend : la capacité, et de quoi la RENDRE COMPTE. */
export interface ResolutionDeStockageAssemblee {
  /** La capacité à injecter dans le gate / la sonde. C'est l'objet du module. */
  readonly resolveStorage: ResolveStorageFn;
  /**
   * Les autorités effectivement inscrites. Exposées pour qu'un appelant puisse
   * DIRE avec quoi il a résolu — un chemin qui ne sait pas nommer son autorité
   * ne peut pas rendre compte de ce qu'il a fait.
   */
  readonly autorites: readonly AutoriteDeLocalisation[];
  /** Ce que le registre a rendu, pièce par pièce. Pour le compte rendu. */
  readonly localisations: ReadonlyMap<string, StorageLocation>;
}

/**
 * Un `StorageLocationSqlRunner` à partir d'un client Prisma.
 *
 * Il vit ICI et pas dans chaque script : c'est la même raison que le reste du
 * fichier — un adaptateur recopié est un adaptateur qui diverge.
 */
export function runnerDepuisPrisma(prisma: {
  $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown>;
}): StorageLocationSqlRunner {
  return {
    query: (sql, params) =>
      prisma.$queryRawUnsafe(sql, ...(params ?? [])) as Promise<never[]>,
  };
}

/**
 * ASSEMBLE la chaîne complète pour un lot de pièces, et rend la capacité de
 * résoudre. C'est LE chemin de production.
 *
 * L'ordre est le contrat :
 *   1. LIRE le registre gouverné pour ces pièces        (asynchrone, en base)
 *   2. en faire une AUTORITÉ de localisation            (pur, `autoriteDuRegistre…`)
 *   3. en faire un RÉSOLVEUR, ouvreur compris           (pur, `resolveurGouverne`)
 *
 * L'étape 1 est la seule qui touche la base : la résolution reste pure, et la
 * base reste au bord. C'est la contrainte posée par `storageResolution.ts`, et
 * elle est la raison pour laquelle le registre est LU ici plutôt que dans la
 * fonction de résolution.
 *
 * ⚠️ Les pièces HORS du lot ne sont pas résolvables par la capacité rendue :
 * l'autorité ne revendique que ce que le registre a rendu pour `refs`. Ce n'est
 * pas une limite à contourner, c'est la même règle que partout — ne rien savoir
 * d'une pièce n'autorise pas à supposer où elle est.
 */
export async function assemblerResolutionDeStockage(
  db: StorageLocationSqlRunner,
  refs: readonly StorageLocationRef[],
  env: Record<string, string | undefined> = process.env,
): Promise<ResolutionDeStockageAssemblee> {
  // ── 1 · LE REGISTRE. SELECT, et rien d'autre.
  const localisations = await readStorageLocations(db, refs);

  // ── 2 · LES AUTORITÉS. Le registre statique (vide par constat) PLUS le pont
  // vers le registre gouverné. C'est cette ligne que le chemin de production
  // n'avait pas, et c'est elle que le mutant retire.
  const autorites: readonly AutoriteDeLocalisation[] = Object.freeze([
    ...AUTORITES_DE_LOCALISATION,
    autoriteDuRegistreDeLocalisation(localisations),
  ]);

  // ── 3 · LE RÉSOLVEUR, ouvreur gouverné compris.
  return { resolveStorage: resolveurGouverne(env, autorites), autorites, localisations };
}
