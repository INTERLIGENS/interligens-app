/**
 * mesure-localisation.ts — LA MESURE DISCRIMINANTE. LECTURE SEULE ABSOLUE.
 *
 * ██  `HeadObject` UNIQUEMENT. Aucun GET, aucun PUT, aucun DELETE, aucune      ██
 * ██  lecture de configuration. 0 octet transféré. AUCUNE ÉCRITURE EN BASE.    ██
 * ██  AUCUNE LIGNE INSCRITE — ce script PRÉPARE, il ne pose rien.              ██
 *
 *   « Finding an evidence object in one compartment establishes presence there;
 *     it establishes authoritative location only when competing governed
 *     compartments have also been measurably excluded. »
 *
 * ─── CE QUE CE SCRIPT EST, ET SURTOUT CE QU'IL N'EST PAS ────────────────────
 *
 * C'est un INSTRUMENT DE MESURE, à usage humain, hors du chemin gouverné.
 *
 * ⛔ CE N'EST PAS UN RÉSOLVEUR. `resoudreLocalisation` ne l'appelle pas et ne
 * doit jamais l'appeler. Sonder deux compartiments pour voir « lequel répond »
 * est le REPLI que le ruling interdit : la résolution serait dérivée d'une
 * observation réseau, pas d'une autorité. Un témoin structurel vérifie qu'aucun
 * module de `src/lib/evidence-chain/` ne l'importe.
 *
 * ⛔ CE N'EST PAS UNE CONVENTION DE PRÉFIXE. Le script ne lit pas `reports/`
 * dans la clé pour deviner : il INTERROGE les deux compartiments et rapporte ce
 * que chacun répond. Une convention DEVINE, une mesure CONSTATE.
 *
 * ─── LES DEUX IDENTITÉS, ET POURQUOI ELLES SONT SÉPARÉES ────────────────────
 *
 * Chaque compartiment est interrogé avec SES PROPRES credentials :
 *
 *   interligens-reports   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   interligens-evidence  R2_EVIDENCE_RO_ACCESS_KEY_ID / R2_EVIDENCE_RO_SECRET_ACCESS_KEY
 *                         ↑ un credential EN LECTURE SEULE, dédié à la mesure
 *
 * ⛔ AUCUN REPLI D'UNE IDENTITÉ SUR L'AUTRE. Si les variables `_RO_` manquent,
 * le script REFUSE avec une cause nommée. Se rabattre sur les credentials de
 * `reports` reproduirait exactement le 403 du 2026-09-15 — et le ferait passer
 * pour une mesure. Mieux vaut ne pas mesurer que mesurer faux.
 *
 * ⛔ AUCUNE VALEUR DE SECRET N'EST IMPRIMÉE, nulle part : ni log, ni rapport, ni
 * JSON, ni message d'erreur. Seuls les NOMS de variables apparaissent. Les
 * valeurs sont CONSOMMÉES, jamais montrées.
 *
 * ─── LE VERDICT : QUATRE VALEURS, ET UNE SEULE AUTORISE UNE LIGNE ───────────
 *
 * La table de décision et ses trois refus vivent dans
 * `src/lib/evidence-chain/discrimination.ts` — PUR, éprouvé sans réseau.
 * Ici : le câblage, et rien d'autre.
 *
 *     npx tsx src/scripts/evidence-chain/mesure-localisation.ts [--json] [--inserts <fichier>]
 *
 * Sortie : 0 si la mesure a abouti (même avec des anomalies rapportées),
 *          1 en UNABLE — configuration insuffisante pour mesurer.
 */
import path from "node:path";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";
import {
  classerReponse,
  discriminer,
  candidatesAInscription,
  type Sonde,
  rendreInscriptions,
  anomaliesDeForme,
  FORME_R2,
  type PieceDiscriminee,
  type Verdict,
} from "../../lib/evidence-chain/discrimination";

const REPO = path.resolve(__dirname, "..", "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");

// ═══════════════════════════════════════════════════════════════════════════
// L'IDENTITÉ INSTRUMENTALE — ÉPINGLÉE, ET ELLE NE SUIVRA JAMAIS HEAD
// ═══════════════════════════════════════════════════════════════════════════
//
//   « Machine-observed facts should identify the instrument that produced the
//     observation; substituting a human operator as observer creates authority
//     that did not perform the measurement. »
//
// Un 404 sur un compartiment R2 est constaté par un PROGRAMME. Inscrire une
// personne comme observateur créerait une autorité qui n'a pas fait la mesure —
// c'est pourquoi `declared_by` et `observed_by` nomment un fichier à un commit,
// et non « T1 ».
//
// ⛔ CE SHA NE DOIT JAMAIS ÊTRE REMPLACÉ PAR LE HEAD DU COMMIT QUI INSCRIT.
//    L'attribution désigne l'instrument qui a PRODUIT la mesure, jamais celui
//    qui inscrit ensuite son résultat. Le commit d'inscription vient forcément
//    APRÈS la campagne : le faire suivre HEAD attribuerait l'observation à un
//    code qui n'existait pas quand elle a été faite. C'est le sens même d'un
//    horodatage d'observation, transposé à l'identité.
//
// ⛔ ET IL NE SUIT PAS NON PLUS LES ÉDITIONS DE CE FICHIER. Le présent fichier
//    a changé depuis 93d08a1 (il porte cette constante, précisément). C'est
//    normal et voulu : la constante enregistre un FAIT PASSÉ, pas l'état
//    courant du dépôt.
//
// ⚠️ UNE NOUVELLE CAMPAGNE EXIGE UNE NOUVELLE CONSTANTE. Réutiliser celle-ci
//    pour une passe ultérieure attribuerait une mesure récente à un instrument
//    ancien. Le nom porte la date pour que l'oubli se voie.
//
// ─── ÉTABLI, PAS SUPPOSÉ (2026-09-16) ───────────────────────────────────────
//   · blob de `mesure-localisation.ts` dans 93d08a1 : 2bef7ffacae25e769ec7b3e1025f0e6badcd6e9d
//     — IDENTIQUE au fichier de travail au moment de la vérification.
//   · même identité de blob pour la fermeture de dépendances de l'instrument :
//     `lib/evidence-chain/discrimination.ts` (19901c8719b4…) et
//     `lib/evidence-chain/eligibility.ts` (099cccc7dc96…).
//   · le seul commit postérieur, 6689190, ne touche que `scripts/guard-offline.sh`.
//   · mtime des trois fichiers : 09:20:46Z, 09:20:46Z et 07:14:35Z — tous
//     ANTÉRIEURS à la campagne (09:32:32.725Z). Une modification suivie d'un
//     retour en arrière aurait laissé un mtime POSTÉRIEUR.
//   → au moment des 62 HEAD, l'instrument exécuté était exactement celui de 93d08a1.
export const INSTRUMENT_CAMPAGNE_2026_09_15 =
  "src/scripts/evidence-chain/mesure-localisation.ts@93d08a1";
const IDX_INSERTS = process.argv.indexOf("--inserts");
const FICHIER_INSERTS = IDX_INSERTS >= 0 ? process.argv[IDX_INSERTS + 1] : null;

/** Un compartiment à interroger, avec l'identité qui lui est propre. */
interface CompartimentAInterroger {
  readonly bucket: string;
  readonly s3: S3Client;
}

/**
 * Construit les deux compartiments, ou REFUSE en nommant ce qui manque.
 *
 * ⛔ Aucun `||` entre les deux identités. C'est le sujet : un repli des
 * credentials de mesure sur ceux de `reports` rendrait un 403 sur
 * `interligens-evidence`, et ce 403 serait présenté comme une mesure.
 */
function construireCompartiments():
  | { ok: true; compartiments: CompartimentAInterroger[] }
  | { ok: false; cause: string; detail: string } {
  const compte = (process.env.R2_ACCOUNT_ID ?? "").trim();
  const endpoint = (process.env.R2_ENDPOINT ?? "").trim() || (compte ? `https://${compte}.r2.cloudflarestorage.com` : "");

  const bucketArchives = (process.env.R2_BUCKET_NAME ?? "").trim();
  const cleArchives = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretArchives = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();

  // Le défaut nomme le compartiment CONCURRENT à exclure — ce n'est pas une
  // supposition sur l'endroit où vit une pièce donnée, mais la liste des
  // compartiments gouvernés qu'il faut avoir interrogés pour discriminer.
  // `R2_EVIDENCE_BUCKET_NAME` le remplace dès qu'elle est provisionnée.
  const bucketPreuves = (process.env.R2_EVIDENCE_BUCKET_NAME ?? "").trim() || "interligens-evidence";
  // Le credential DÉDIÉ à la mesure, en lecture seule. Aucun repli.
  const cleRo = (process.env.R2_EVIDENCE_RO_ACCESS_KEY_ID ?? "").trim();
  const secretRo = (process.env.R2_EVIDENCE_RO_SECRET_ACCESS_KEY ?? "").trim();

  const manquants = [
    !compte && "R2_ACCOUNT_ID",
    !bucketArchives && "R2_BUCKET_NAME",
    !cleArchives && "R2_ACCESS_KEY_ID",
    !secretArchives && "R2_SECRET_ACCESS_KEY",
  ].filter(Boolean) as string[];
  if (manquants.length > 0) {
    return {
      ok: false,
      cause: "archives_credentials_unconfigured",
      detail: `variables manquantes : ${manquants.join(", ")}.`,
    };
  }

  const manquantsRo = [
    !cleRo && "R2_EVIDENCE_RO_ACCESS_KEY_ID",
    !secretRo && "R2_EVIDENCE_RO_SECRET_ACCESS_KEY",
  ].filter(Boolean) as string[];
  if (manquantsRo.length > 0) {
    return {
      ok: false,
      cause: "evidence_readonly_credential_unconfigured",
      detail:
        `variables manquantes : ${manquantsRo.join(", ")}.\n` +
        `Le compartiment « ${bucketPreuves} » ne peut pas être interrogé, donc les concurrents\n` +
        "gouvernés ne peuvent pas être MESURABLEMENT EXCLUS, donc AUCUNE localisation ne peut\n" +
        "être discriminée. Le script ATTEND ce credential.\n\n" +
        "⛔ Il ne se rabat PAS sur R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY : ces identifiants\n" +
        "   sont scopés sur les archives et rendraient un 403 sur le compartiment de preuves.\n" +
        "   Ce 403 serait alors présenté comme une mesure, alors qu'il n'en est pas une.\n" +
        "   Mieux vaut ne pas mesurer que mesurer faux.",
    };
  }

  // ── LA FORME, AVANT LA PREMIÈRE SONDE. Un secret mal recopié rend 31 × 403,
  // indiscernables d'un 403 de PORTÉE — et les deux appellent des gestes
  // opposés. Mesuré en vif le 2026-09-15 : un caractère parasite en fin de
  // secret a produit exactement cette confusion.
  // ⛔ On ne RÉPARE pas, on REFUSE. Rogner le caractère serait deviner un
  //    credential, c'est-à-dire mesurer avec une valeur que personne n'a validée.
  const anomalies = anomaliesDeForme([
    { variable: "R2_EVIDENCE_RO_ACCESS_KEY_ID", valeur: cleRo, longueur: FORME_R2.cleLongueur },
    { variable: "R2_EVIDENCE_RO_SECRET_ACCESS_KEY", valeur: secretRo, longueur: FORME_R2.secretLongueur },
  ]);
  if (anomalies.length > 0) {
    return {
      ok: false,
      cause: "evidence_readonly_credential_malformed",
      detail:
        anomalies.map((a) => `  · ${a.variable} : attendu ${a.attendu}, observé ${a.observe}`).join("\n") +
        "\n\nLa forme du credential est manifestement invalide : les sondes rendraient 403, et ce 403\n" +
        "ressemblerait trait pour trait à un défaut de PORTÉE. Les deux pannes appellent des gestes\n" +
        "opposés — refaire un token contre corriger une ligne de .env.local — et on ne les devine pas.\n\n" +
        "⛔ Aucune correction automatique. Rogner un caractère parasite reviendrait à mesurer avec une\n" +
        "   valeur que personne n'a validée. Corrigez .env.local, puis relancez.\n" +
        "   (Aucune valeur n'est affichée ci-dessus : seulement des longueurs et des positions.)",
    };
  }

  const faire = (accessKeyId: string, secretAccessKey: string) =>
    new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });

  return {
    ok: true,
    compartiments: [
      { bucket: bucketArchives, s3: faire(cleArchives, secretArchives) },
      { bucket: bucketPreuves, s3: faire(cleRo, secretRo) },
    ],
  };
}

/** UNE sonde. `HeadObject`, et rien d'autre. */
async function sonder(c: CompartimentAInterroger, key: string): Promise<Sonde> {
  try {
    await c.s3.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
    return classerReponse(c.bucket, { ok: true });
  } catch (e) {
    const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return classerReponse(c.bucket, {
      ok: false,
      statut: err.$metadata?.httpStatusCode,
      nom: err.name,
      message: err.message,
    });
  }
}

async function main() {
  const c = construireCompartiments();
  if (!c.ok) {
    console.error(`\nUNABLE [${c.cause}]\n\n${c.detail}\n`);
    console.error("Aucune sonde n'a été émise. Aucune ligne n'a été préparée.\n");
    process.exit(1);
  }
  const buckets = c.compartiments.map((x) => x.bucket);

  const prisma = new PrismaClient();
  let appels = 0;
  try {
    const univers = tsaPendingUniverseSql();
    const lignes = (await prisma.$queryRawUnsafe(
      `SELECT "id","r2Key" FROM "EvidenceItem" WHERE ${univers} ORDER BY "ingestedAt" ASC`,
    )) as Array<{ id: string; r2Key: string | null }>;

    const pieces: PieceDiscriminee[] = [];
    for (const l of lignes) {
      const k = (l.r2Key ?? "").trim();
      if (!k) {
        // Pas de clé : il n'y a rien à sonder. Ce n'est pas une absence d'octets.
        pieces.push({
          id: l.id, r2Key: "", sondes: [],
          discrimination: discriminer([]),
        });
        continue;
      }
      const sondes: Sonde[] = [];
      for (const comp of c.compartiments) {
        appels++;
        sondes.push(await sonder(comp, k));
      }
      pieces.push({ id: l.id, r2Key: k, sondes, discrimination: discriminer(sondes) });
    }

    const candidates = candidatesAInscription(pieces);

    if (AS_JSON) {
      console.log(JSON.stringify({ univers, buckets, appelsHead: appels, pieces }, null, 2));
    } else {
      console.log(`[mesure-localisation] univers : ${univers}`);
      console.log(`[mesure-localisation] compartiments interrogés : ${buckets.join(" · ")}`);
      console.log(`[mesure-localisation] ${lignes.length} pièce(s) · ${appels} appel(s) HeadObject · 0 octet transféré\n`);

      const parVerdict = new Map<Verdict, PieceDiscriminee[]>();
      for (const p of pieces) {
        const v = p.discrimination.verdict;
        parVerdict.set(v, [...(parVerdict.get(v) ?? []), p]);
      }
      for (const v of ["LOCALISATION_DISCRIMINEE", "AMBIGUOUS", "ABSENT_DES_DEUX", "NON_MESURABLE"] as const) {
        console.log(`  ${v.padEnd(24)} : ${(parVerdict.get(v) ?? []).length}`);
      }

      console.log("\n─── LE VERDICT DES PIÈCES, UNE PAR UNE ───");
      for (const p of pieces) {
        const sondes = p.sondes.map((s) => `${s.bucket}=${s.presence}`).join(" / ") || "aucune sonde";
        console.log(`  ${p.id}  ${p.discrimination.verdict}`);
        console.log(`      ${sondes}`);
        if (p.discrimination.compartiment) console.log(`      → ${p.discrimination.compartiment}`);
      }

      console.log(`\n  CANDIDATES À VERIFIED_BY_HEAD : ${candidates.length} / ${pieces.length}`);
      const parCause = new Map<string, number>();
      for (const p of pieces) {
        if (p.discrimination.verdict === "LOCALISATION_DISCRIMINEE") continue;
        parCause.set(p.discrimination.motif, (parCause.get(p.discrimination.motif) ?? 0) + 1);
      }
      for (const [motif, n] of parCause) console.log(`      · ${n} × ${motif}`);
    }

    if (FICHIER_INSERTS) {
      if (candidates.length === 0) {
        console.error("\n⛔ AUCUNE candidate : aucun fichier d'INSERT n'est écrit. Une localisation non");
        console.error("   discriminée n'a pas de ligne, et un fichier vide inviterait à le combler à la main.");
      } else {
        // ⚠️ L'horloge est lue UNE FOIS, ICI, c'est-à-dire APRÈS la boucle de
        // sondes. Cet instrument n'enregistre PAS l'instant de chaque HEAD :
        // `Sonde` ne porte pas de champ temporel. La valeur rendue est donc
        // l'horodatage de CLÔTURE DE LA CAMPAGNE, et l'en-tête du fichier le
        // qualifie comme tel.
        // ⛔ On ne fabrique PAS 31 pseudo-instants pour « faire plus précis ».
        //    Une précision reconstruite n'est pas une précision capturée.
        const quand = new Date().toISOString();
        writeFileSync(FICHIER_INSERTS, rendreInscriptions(
          candidates,
          // Les deux identités désignent ICI le même instrument : celui qui a
          // sondé rend aussi l'inscription. Les paramètres restent DEUX parce
          // que ce ne sera pas toujours vrai.
          { inscritPar: INSTRUMENT_CAMPAGNE_2026_09_15, observePar: INSTRUMENT_CAMPAGNE_2026_09_15 },
          quand,
          "HORODATAGE DE CAMPAGNE — instant de CLÔTURE de la passe d'observation, lu une " +
            "seule fois après les 62 sondes. Ce n'est PAS l'instant de chaque HEAD : " +
            "l'instrument ne les a pas capturés, et on ne les reconstruit pas.",
        ));
        console.log(`\n  SQL PRÊT À COLLER écrit : ${FICHIER_INSERTS} (${candidates.length} ligne(s))`);
      }
    }

    console.log("\n⛔ AUCUNE LIGNE INSCRITE. Ce script PRÉPARE des lignes VERIFIED_BY_HEAD ;");
    console.log("   leur inscription est une écriture de production, soumise à l'autorisation");
    console.log("   du fondateur. Ce script n'écrit rien en base, nulle part.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error("[mesure-localisation] FATAL", e); process.exit(1); });
}
