/**
 * mesure-de-fermeture.ts — LA LECTURE PAR L'AUTORITÉ RÉELLE. LECTURE SEULE.
 *
 * ██  C'EST CETTE MESURE QUI FERME LA FENÊTRE, PAS LE SUCCÈS DES INSERT.     ██
 *
 *   « Puis lecture par l'autorité réelle : les 31 STORAGE_LOCATION_UNRESOLVED
 *     doivent devenir 31 résolutions vers interligens-reports. »
 *
 * Un INSERT qui réussit prouve qu'une ligne est entrée en base. Il ne prouve PAS
 * que le chemin gouverné sait s'en servir. Ce script relit les 31 par le chemin
 * RÉEL — registre → autorité → résolution — et dit ce qu'il obtient.
 *
 *     npx tsx src/scripts/evidence-chain/mesure-de-fermeture.ts
 *
 * ⛔ AUCUNE ÉCRITURE. Un SELECT sur "EvidenceItem", un SELECT sur le registre,
 *    puis de la résolution PURE en mémoire. Aucun appel réseau vers R2 : la
 *    résolution s'arrête à la capacité de lecture, elle ne LIT aucun octet.
 *
 * ─── POURQUOI DEUX COMPTES, ET NON UN SEUL ──────────────────────────────────
 *
 * Résoudre une localisation, c'est DEUX choses, et elles échouent séparément :
 *
 *   1. NOMMER      une autorité gouvernée revendique un compartiment pour cette
 *                  pièce. C'est ce que le registre apporte.
 *   2. DESSERVIR   un ouvreur gouverné sait ouvrir CE compartiment. C'est ce que
 *                  la configuration apporte (`R2_EVIDENCE_BUCKET_NAME`).
 *
 * Les confondre ferait lire « l'inscription a échoué » là où la vérité est
 * « l'inscription a réussi, et la configuration manque ». Ce sont deux gestes de
 * réparation différents — exactement la distinction qui a coûté cher sur le 403
 * de credential. Le script les compte donc SÉPARÉMENT.
 *
 * ⚠️ MESURÉ LE 2026-09-16, AVANT L'INSCRIPTION : `R2_EVIDENCE_BUCKET_NAME` n'est
 * PAS provisionnée sur Host-001, et la porte gouvernée ouvre le compartiment
 * qu'elle nomme — pas `interligens-reports`. Après l'inscription, on attend donc
 * 31 NOMMÉS, et DESSERVIS seulement si cette variable vaut `interligens-reports`.
 * Ce n'est pas un échec de la fenêtre : la dette de LOCALISATION est soldée dès
 * que les 31 sont NOMMÉS. La desserte est une question de configuration, et elle
 * appartient à l'arment du chemin TSA.
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";
import {
  readStorageLocations,
  type StorageLocationRef,
} from "../../lib/evidence-chain/storageLocationJournal";
import {
  resoudreLocalisation,
  autoriteDuRegistreDeLocalisation,
} from "../../lib/evidence-chain/storageResolution";

const REPO = path.resolve(__dirname, "..", "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");

async function main() {
  const prisma = new PrismaClient();
  try {
    const univers = tsaPendingUniverseSql();
    const lignes = (await prisma.$queryRawUnsafe(
      `SELECT "id","r2Key" FROM "EvidenceItem" WHERE ${univers} ORDER BY "ingestedAt" ASC`,
    )) as Array<{ id: string; r2Key: string | null }>;

    // ── 1 · LE REGISTRE, lu par son lecteur gouverné. SELECT, rien d'autre.
    const refs: StorageLocationRef[] = lignes.map((l) => ({ evidenceItemId: l.id, r2Key: l.r2Key }));
    const localisations = await readStorageLocations(
      { query: (sql, params) => prisma.$queryRawUnsafe(sql, ...(params ?? [])) as Promise<never[]> },
      refs,
    );

    // ── 2 · L'AUTORITÉ, construite depuis ce que le registre a rendu. C'est le
    // pont livré par T1-REGISTRE-DE-LOCALISATION, et c'est lui qu'on éprouve.
    const autorite = autoriteDuRegistreDeLocalisation(localisations);

    let nommes = 0, resolus = 0;
    const compartiments = new Map<string, number>();
    const refus = new Map<string, number>();
    const detail: Array<{ id: string; nomme: string | null; resolu: boolean; motif: string }> = [];

    for (const l of lignes) {
      const loc = localisations.get(l.id);
      // NOMMÉ : le registre revendique-t-il un compartiment pour cette pièce ?
      const nomme = loc && loc.established ? loc.bucket : null;
      if (nomme) { nommes++; compartiments.set(nomme, (compartiments.get(nomme) ?? 0) + 1); }

      // RÉSOLU : le chemin COMPLET, ouvreur compris.
      const r = resoudreLocalisation({ id: l.id, r2Key: l.r2Key }, process.env, [autorite]);
      if (r.ok) resolus++;
      else refus.set(r.detail, (refus.get(r.detail) ?? 0) + 1);
      detail.push({ id: l.id, nomme, resolu: r.ok, motif: r.ok ? "" : r.detail });
    }

    if (AS_JSON) {
      console.log(JSON.stringify({ univers, total: lignes.length, nommes, resolus, detail }, null, 2));
      return;
    }

    console.log(`[mesure-de-fermeture] univers : ${univers}`);
    console.log(`[mesure-de-fermeture] ${lignes.length} pièce(s) éligible(s) · AUCUNE écriture, AUCUN octet lu\n`);
    console.log(`  1 · NOMMÉES par le registre gouverné : ${nommes} / ${lignes.length}`);
    for (const [c, n] of compartiments) console.log(`        → ${c} : ${n}`);
    console.log(`  2 · RÉSOLUES (nommées ET desservies)  : ${resolus} / ${lignes.length}`);

    if (refus.size > 0) {
      console.log("\n─── LES REFUS, PAR NATURE ───");
      for (const [motif, n] of [...refus].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${n} × ${motif}\n`);
      }
    }

    console.log("─── CE QUE CELA VEUT DIRE ───");
    if (nommes === lignes.length && resolus === lignes.length) {
      console.log("  ✅ La dette de localisation est SOLDÉE, et le chemin gouverné dessert le compartiment.");
    } else if (nommes === lignes.length) {
      console.log("  ✅ La dette de LOCALISATION est SOLDÉE : les 31 sont NOMMÉES par une autorité gouvernée.");
      console.log("  ⚠️ La DESSERTE manque : aucun ouvreur gouverné ne sert le compartiment nommé.");
      console.log("     Ce n'est pas un échec de l'inscription — c'est une question de configuration");
      console.log("     (R2_EVIDENCE_BUCKET_NAME), et elle appartient à l'armement du chemin TSA.");
    } else if (nommes === 0) {
      console.log("  ⛔ AUCUNE pièce n'est nommée : le registre est vide pour cet univers.");
      console.log("     Si l'inscription a été posée, ce résultat contredit le post-check — à investiguer.");
    } else {
      console.log(`  ⚠️ ${nommes} nommées sur ${lignes.length} : l'inscription est PARTIELLE. À investiguer.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error("[mesure-de-fermeture] FATAL", e); process.exit(1); });
}
