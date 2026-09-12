// src/lib/storage/types.ts
import type { ClasseDeRetention, NatureObjet } from "./registre/contrat";

export type StorageEnv = "production" | "preview" | "development";

export interface PdfUploadInput {
  buffer: Buffer;
  /**
   * L'identité SÉMANTIQUE de l'artefact. Elle part au REGISTRE, et n'entre
   * plus dans la clé : une clé voyage — elle est le chemin d'une URL signée
   * remise à un tiers — et ce qu'elle encode est donc rendu, même si aucune
   * interface ne l'affiche.
   */
  subject: string;
  batchId?: string;
  /** Défaut CASEFILE_RENDER. Posé à l'allocation, jamais modifié ensuite. */
  natureObjet?: NatureObjet;
  /** Défaut EVIDENTIARY_INDEFINITE — D2. Une décision enregistrée, pas une garantie. */
  classeDeRetention?: ClasseDeRetention;
}

export interface PdfUploadResult {
  key: string;
  signedUrl: string;
  sizeBytes: number;
  sha256: string;
  /**
   * L'identifiant de registre. C'est LUI qui permet de dire à un cabinet
   * « l'artefact que vous ouvrez est celui qui a été enregistré » : il relie
   * le fichier remis à la ligne d'autorité qui l'a fondé.
   */
  registreId: string;
}
