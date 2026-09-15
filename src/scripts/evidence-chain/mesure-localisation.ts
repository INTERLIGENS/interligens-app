/**
 * mesure-localisation.ts — OÙ SONT RÉELLEMENT LES OCTETS DES PIÈCES ÉLIGIBLES ?
 *
 * ██  LECTURE SEULE ABSOLUE. AUCUN OCTET TRANSFÉRÉ. AUCUNE ÉCRITURE.         ██
 * ██  `HeadObject` UNIQUEMENT — jamais `GetObject`, jamais `PutObject`.      ██
 * ██  AUCUN INSERT : ce script PRÉPARE des lignes, il n'en pose AUCUNE.      ██
 *
 * ─── CE QUE CE SCRIPT EST, ET SURTOUT CE QU'IL N'EST PAS ────────────────────
 *
 * C'est un INSTRUMENT DE MESURE, à usage humain, hors du chemin gouverné.
 *
 * ⛔ CE N'EST PAS UN RÉSOLVEUR. `resoudreLocalisation` ne l'appelle pas, ne
 * l'appellera pas, et ne doit jamais l'appeler. Sonder deux compartiments pour
 * voir « lequel répond » est précisément le REPLI que le ruling interdit : la
 * résolution serait alors dérivée d'une observation réseau, pas d'une autorité.
 * Un témoin structurel vérifie qu'aucun module de `src/lib/` n'importe ce
 * fichier.
 *
 * ⛔ CE N'EST PAS UNE CONVENTION DE PRÉFIXE. Le script ne LIT pas `reports/`
 * dans la clé pour en déduire le compartiment — il INTERROGE les deux, et
 * rapporte ce que chacun répond. La différence est tout le sujet : une
 * convention DEVINE, une mesure CONSTATE.
 *
 * ─── LA DOCTRINE DU RÉSULTAT, ET ELLE EST STRICTE ───────────────────────────
 *
 * Quatre réponses possibles par pièce, et seule la première établit un fait
 * positif de localisation :
 *
 *   PRESENT_A_UN_SEUL     un compartiment répond 200, l'autre 404
 *                         → fait positif. C'est la ligne VERIFIED_BY_HEAD
 *                           que le fondateur pourra faire inscrire.
 *   PRESENT_AUX_DEUX      les deux répondent 200. Ce n'est PAS une ambiguïté
 *                         à arbitrer : c'est un FAIT À RAPPORTER. Deux jeux
 *                         d'octets sous la même clé ne sont pas un objet.
 *   ABSENT_DES_DEUX       les deux répondent 404. À rapporter tel quel — ce
 *                         n'est pas « octets perdus » : on n'a interrogé que
 *                         DEUX compartiments, pas tous.
 *   NON_MESURABLE         au moins une réponse n'est ni 200 ni 404 (403, 5xx,
 *                         réseau). ⚠️ UN REFUS D'INTERMÉDIAIRE N'EST PAS UNE
 *                         ABSENCE. Un 403 sur un compartiment rend la mesure
 *                         de CETTE pièce non concluante, point final. On ne
 *                         « conclut » surtout pas à l'autre compartiment sous
 *                         prétexte qu'il a, lui, répondu.
 *
 * ─── LES DEUX COMPARTIMENTS INTERROGÉS ──────────────────────────────────────
 *
 * Ils sont NOMMÉS par l'environnement, jamais devinés :
 *   R2_BUCKET_NAME           le compartiment historique des archives de rapports
 *   R2_EVIDENCE_BUCKET_NAME  le compartiment de preuves gouverné
 * Si l'une des deux manque, le script sort en UNABLE : mesurer un seul
 * compartiment ne permet pas de discriminer, et rendre « absent de l'autre »
 * sans avoir interrogé l'autre serait exactement la faute qu'on refuse.
 *
 *     npx tsx src/scripts/evidence-chain/mesure-localisation.ts [--json]
 *
 * Sortie : 0 si la mesure a abouti (même avec des anomalies rapportées),
 *          1 en UNABLE — configuration insuffisante pour mesurer.
 */
import path from "node:path";
import { config } from "dotenv";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";

const REPO = path.resolve(__dirname, "..", "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");

/** Le verdict d'UNE sonde sur UN compartiment. Trois états, jamais deux. */
type Sonde = "PRESENT" | "ABSENT" | "NON_MESURABLE";

/** Le verdict d'une pièce, croisant les deux sondes. */
export type VerdictLocalisation =
  | "PRESENT_A_UN_SEUL"
  | "PRESENT_AUX_DEUX"
  | "ABSENT_DES_DEUX"
  | "NON_MESURABLE";

export interface MesureDUnePiece {
  readonly id: string;
  readonly r2Key: string;
  readonly parCompartiment: ReadonlyArray<{ bucket: string; sonde: Sonde; detail: string }>;
  readonly verdict: VerdictLocalisation;
  /** Le compartiment établi — UNIQUEMENT si le verdict est PRESENT_A_UN_SEUL. */
  readonly compartimentEtabli: string | null;
}

/**
 * Croise les sondes en un verdict. PUR — testable sans réseau.
 *
 * L'ordre des règles est le contrat : NON_MESURABLE l'emporte sur tout. Une
 * pièce dont un compartiment a refusé de répondre n'est pas « présente dans
 * l'autre » : elle est non mesurée. Placer cette règle en dernier laisserait
 * un 200 + 403 conclure à PRESENT_A_UN_SEUL — une localisation établie sur une
 * non-observation.
 */
export function croiser(
  sondes: ReadonlyArray<{ bucket: string; sonde: Sonde }>,
): { verdict: VerdictLocalisation; compartimentEtabli: string | null } {
  if (sondes.length < 2) return { verdict: "NON_MESURABLE", compartimentEtabli: null };
  if (sondes.some((s) => s.sonde === "NON_MESURABLE")) {
    return { verdict: "NON_MESURABLE", compartimentEtabli: null };
  }
  const presents = sondes.filter((s) => s.sonde === "PRESENT");
  if (presents.length === 0) return { verdict: "ABSENT_DES_DEUX", compartimentEtabli: null };
  if (presents.length > 1) return { verdict: "PRESENT_AUX_DEUX", compartimentEtabli: null };
  return { verdict: "PRESENT_A_UN_SEUL", compartimentEtabli: presents[0].bucket };
}

/** Traduit une réponse HeadObject en sonde. 404 ⇒ ABSENT ; tout le reste qui
 * n'est pas 200 ⇒ NON_MESURABLE. Un 403 n'est PAS une absence. */
export function sonderDepuisReponse(
  ok: boolean,
  statut: number | undefined,
  nom: string | undefined,
): { sonde: Sonde; detail: string } {
  if (ok) return { sonde: "PRESENT", detail: "HTTP 200" };
  if (statut === 404 || nom === "NotFound" || nom === "NoSuchKey") {
    return { sonde: "ABSENT", detail: `HTTP 404 (${nom ?? "NotFound"})` };
  }
  return {
    sonde: "NON_MESURABLE",
    detail: `HTTP ${statut ?? "?"} (${nom ?? "erreur"}) — un refus d'intermédiaire n'est pas une absence`,
  };
}

async function main() {
  const compte = (process.env.R2_ACCOUNT_ID ?? "").trim();
  const cle = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secret = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
  const bucketArchives = (process.env.R2_BUCKET_NAME ?? "").trim();
  const bucketPreuves = (process.env.R2_EVIDENCE_BUCKET_NAME ?? "").trim();

  const manquants = [
    !compte && "R2_ACCOUNT_ID",
    !cle && "R2_ACCESS_KEY_ID",
    !secret && "R2_SECRET_ACCESS_KEY",
    !bucketArchives && "R2_BUCKET_NAME",
    !bucketPreuves && "R2_EVIDENCE_BUCKET_NAME",
  ].filter(Boolean) as string[];
  if (manquants.length > 0) {
    console.error(
      `UNABLE — variables manquantes : ${manquants.join(", ")}.\n` +
        "Mesurer UN SEUL compartiment ne discrimine rien : rendre « absent de l'autre » sans avoir\n" +
        "interrogé l'autre serait une non-observation présentée comme un fait. On ne mesure pas.",
    );
    process.exit(1);
  }
  const buckets = [bucketArchives, bucketPreuves];

  const s3 = new S3Client({
    region: "auto",
    endpoint: (process.env.R2_ENDPOINT ?? "").trim() || `https://${compte}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cle, secretAccessKey: secret },
  });

  const prisma = new PrismaClient();
  let appels = 0;
  try {
    const univers = tsaPendingUniverseSql();
    const lignes = (await prisma.$queryRawUnsafe(
      `SELECT "id","r2Key" FROM "EvidenceItem" WHERE ${univers} ORDER BY "ingestedAt" ASC`,
    )) as Array<{ id: string; r2Key: string | null }>;

    const mesures: MesureDUnePiece[] = [];
    for (const l of lignes) {
      const k = (l.r2Key ?? "").trim();
      if (!k) {
        // Pas de clé : il n'y a rien à sonder. Ce n'est pas une absence d'octets.
        mesures.push({
          id: l.id, r2Key: "", parCompartiment: [],
          verdict: "NON_MESURABLE", compartimentEtabli: null,
        });
        continue;
      }
      const par: Array<{ bucket: string; sonde: Sonde; detail: string }> = [];
      for (const b of buckets) {
        appels++;
        try {
          await s3.send(new HeadObjectCommand({ Bucket: b, Key: k }));
          par.push({ bucket: b, ...sonderDepuisReponse(true, 200, undefined) });
        } catch (e) {
          const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
          par.push({ bucket: b, ...sonderDepuisReponse(false, err.$metadata?.httpStatusCode, err.name) });
        }
      }
      mesures.push({ id: l.id, r2Key: k, parCompartiment: par, ...croiser(par) });
    }

    const parVerdict = new Map<VerdictLocalisation, MesureDUnePiece[]>();
    for (const m of mesures) parVerdict.set(m.verdict, [...(parVerdict.get(m.verdict) ?? []), m]);

    if (AS_JSON) {
      console.log(JSON.stringify({ univers, buckets, appelsHead: appels, mesures }, null, 2));
    } else {
      console.log(`[mesure-localisation] univers : ${univers}`);
      console.log(`[mesure-localisation] compartiments interrogés : ${buckets.join(" · ")}`);
      console.log(`[mesure-localisation] ${lignes.length} pièce(s) · ${appels} appel(s) HeadObject · 0 octet transféré\n`);
      for (const v of ["PRESENT_A_UN_SEUL", "PRESENT_AUX_DEUX", "ABSENT_DES_DEUX", "NON_MESURABLE"] as const) {
        const l = parVerdict.get(v) ?? [];
        console.log(`  ${v.padEnd(20)} : ${l.length}`);
        const ou = new Map<string, number>();
        for (const m of l) {
          const c = m.compartimentEtabli ?? m.parCompartiment.map((p) => `${p.bucket}=${p.sonde}`).join(" / ") ?? "—";
          ou.set(c, (ou.get(c) ?? 0) + 1);
        }
        for (const [c, n] of ou) console.log(`      · ${c} : ${n}`);
      }
      console.log("\n⛔ AUCUNE LIGNE INSCRITE. Cette mesure PRÉPARE des lignes VERIFIED_BY_HEAD ;");
      console.log("   leur inscription est une écriture de production, soumise au DDL posé et à");
      console.log("   l'autorisation du fondateur. Ce script n'écrit rien, nulle part.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error("[mesure-localisation] FATAL", e); process.exit(1); });
}
