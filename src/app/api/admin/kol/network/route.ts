// ─── BUILD 10 / FENÊTRE 2 — LE GRAPHE ADMIN EST UNE FRONTIÈRE DE PUBLICATION ─
//
// ██  Admin contrôle QUI PEUT PRODUIRE l'artefact.                          ██
// ██  Cela ne gouverne pas CE QUE L'ARTEFACT PEUT PUBLIER.                  ██
//
// Cette route alimente un graphe consultable depuis une session admin
// navigateur. Ce qu'elle rend est copiable, exportable, transmissible — c'est
// donc une frontière de publication, et les gates du produit s'y appliquent.
//
// ─── Ce qui a été mesuré, le 2026-09-08, sur ep-square-band ───────────────
//
//   482  lignes KolWallet servies BRUTES par `SELECT *`
//   303  d'entre elles NON publiables (isPubliclyUsable <> true, ou inactives)
//     2  labels tombant sous PROHIBITED_PUBLIC_STRINGS :
//          « Mom wallet — received GHOST + BOTIFY insider supply, sold »
//          « Dad wallet — received insider supply, dumped »
//     3  profils confirmed_scammer, dont 1 totalScammed NULL, 0 réellement à 0
//
// Le point qui décide du périmètre : les DEUX labels bloqués portent
// `isPubliclyUsable = true` ET `status = 'active'`. Le filtre de publiabilité
// ne les arrête pas. Les deux gates sont indépendantes, et il faut les deux.
//
// ─── Ce que cette route ne fait PAS ───────────────────────────────────────
//
// Elle ne touche pas la donnée. Aucun label n'est réécrit, aucune ligne purgée.
// INTERNE / FORENSIC peut porter une donnée non publiable — c'est même sa
// raison d'être. La gate s'applique AU POINT DE CONSOMMATION, ici, et l'enquête
// garde son matériel intact en base.
//
// Aucune gate n'est recopiée. `PUBLISHABLE_WALLET_FILTER`, `isWalletPublishable`,
// `checkPublishability` (qui porte `PROHIBITED_PUBLIC_STRINGS`) et
// `isMonetaryClaimPublished` sont APPELÉES.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  PUBLISHABLE_WALLET_FILTER,
  WALLET_PUBLICATION_SELECT,
  isWalletPublishable,
} from '@/lib/kol-memory/walletPublication'
import { checkPublishability, type KolProfilePublic } from '@/lib/kol/types'
// `isMonetaryClaimPublished` est LA décision ; `monetaryState` ne fait que la
// NOMMER. On n'appelle pas `redactMonetary` en plus : il rendrait la même
// valeur sans dire dans quel état elle est, et l'état est ce qui manquait.
import {
  isMonetaryClaimPublished,
  MONETARY_PUBLICATION_SELECT,
} from '@/lib/publication/monetaryGate'
import { monetaryState, monetaryValue, type MonetaryState } from '@/lib/publication/absenceVocabulary'

export const dynamic = 'force-dynamic'

/**
 * Un texte libre porte-t-il une formulation que le produit interdit en sortie ?
 *
 * `checkPublishability` est LA gate — c'est elle qui détient
 * `PROHIBITED_PUBLIC_STRINGS`, et cette liste n'est pas exportée. On ne la
 * recopie donc pas : on interroge la gate sur un profil minimal ne portant que
 * le texte à juger. Sans dossier ni preuve, ses quatre autres règles ne
 * produisent rien, et son verdict porte exactement sur ce texte.
 *
 * Le jour où un terme est ajouté à la liste, cette route le respecte sans être
 * modifiée. C'est tout l'intérêt de ne pas dupliquer.
 */
function texteBloque(texte: string | null | undefined): boolean {
  if (!texte) return false
  const minimal = { notes: texte, wallets: [], caseLinks: [] } as unknown as KolProfilePublic
  return !checkPublishability(minimal, []).publishable
}

/** Le texte, ou son absence DITE. Jamais une chaîne vide qui se lirait « pas de label ». */
const BLOQUE = 'WITHHELD — formulation non publiable (Publishing Standard v1 §F)'
const texteGate = (t: string | null | undefined): string | null =>
  texteBloque(t) ? BLOQUE : (t ?? null)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    // ── SORTIE MINIMALE — les colonnes sont ÉNUMÉRÉES, jamais `SELECT *` ──
    //
    // Ce qui n'est pas lu ne peut pas fuir. La page consomme 5 champs sur un
    // wallet et 6 sur un dossier ; `SELECT *` en rendait 17 et 15, dont
    // `attributionNote`, `sourceUrl`, `attributionSource` et `attributionStatus`
    // — du matériel d'enquête que personne n'affiche.
    const kols = await prisma.kolProfile.findMany({
      where: { riskFlag: 'confirmed_scammer' },
      select: {
        handle: true,
        displayName: true,
        rugCount: true,
        totalScammed: true,
        status: true,
        verified: true,
        ...MONETARY_PUBLICATION_SELECT,
      },
      orderBy: { totalScammed: { sort: 'desc', nulls: 'last' } },
    })

    // ── LES ADRESSES PASSENT PAR LA GATE DE PUBLIABILITÉ ─────────────────
    //
    // Le `where` et le prédicat disent la même chose ; le second attrape le cas
    // où une requête future oublierait le premier.
    const walletRows = await prisma.kolWallet.findMany({
      where: PUBLISHABLE_WALLET_FILTER,
      select: {
        id: true,
        kolHandle: true,
        address: true,
        chain: true,
        label: true,
        ...WALLET_PUBLICATION_SELECT,
      },
    })
    const wallets = walletRows.filter(isWalletPublishable).map((w) => ({
      id: w.id,
      kolHandle: w.kolHandle,
      address: w.address,
      chain: w.chain,
      // Le défaut est le RENDU, pas la donnée : le label reste intact en base.
      label: texteGate(w.label),
    }))

    const caseRows = await prisma.kolCase.findMany({
      select: {
        id: true,
        kolHandle: true,
        caseId: true,
        role: true,
        paidUsd: true,
        evidence: true,
      },
    })

    // `paidUsd` est un porteur d'encaissement, nommé comme tel dans
    // `monetaryGate.ts`. Il passe donc par la MÊME décision que
    // `totalDocumented` : un profil dont les proceeds sont retirés ne publie pas
    // ses montants de dossier non plus. La gate est appelée par handle.
    const publication = new Map(kols.map((k) => [k.handle, isMonetaryClaimPublished(k, 'proceeds')]))

    const cases = caseRows.map((c) => {
      const publiable = publication.get(c.kolHandle) ?? false
      const etat = monetaryState(publiable, c.paidUsd)
      return {
        id: c.id,
        kolHandle: c.kolHandle,
        caseId: c.caseId,
        role: c.role,
        // La dégradation voyage À CÔTÉ de la valeur, jamais dedans.
        paidUsd: monetaryValue(etat, c.paidUsd),
        paidUsdState: etat,
        evidence: texteGate(c.evidence),
      }
    })

    // ── Clusters de projet — les dossiers partagés ───────────────────────
    const projectMap: Record<string, string[]> = {}
    for (const c of caseRows) {
      if (!projectMap[c.caseId]) projectMap[c.caseId] = []
      if (!projectMap[c.caseId].includes(c.kolHandle)) projectMap[c.caseId].push(c.kolHandle)
    }

    // ── Connexions — qui a travaillé avec qui ────────────────────────────
    const connections: { a: string; b: string; project: string }[] = []
    for (const [project, handles] of Object.entries(projectMap)) {
      for (let i = 0; i < handles.length; i++) {
        for (let j = i + 1; j < handles.length; j++) {
          connections.push({ a: handles[i], b: handles[j], project })
        }
      }
    }

    return NextResponse.json({
      kols: kols.map((k) => {
        // ── `?? 0` ÉTAIT UNE AFFIRMATION, ET ELLE ÉTAIT FAUSSE ──────────
        //
        // Sur un champ de PRÉJUDICE, zéro ne veut pas dire « nous n'avons pas
        // mesuré » : il veut dire « zéro victime ». Mesuré : sur les 3 profils
        // servis, 1 porte NULL et AUCUN ne porte un vrai 0 — la coercition
        // n'affichait donc rien d'autre qu'une lacune déguisée en bonne
        // nouvelle.
        //
        // La méthodologie de calcul n'est pas touchée. Rien n'est inventé. Le
        // chiffre reste ce qu'il est, et son absence porte son nom.
        const etat: MonetaryState = monetaryState(
          isMonetaryClaimPublished(k, 'scam_scale'),
          k.totalScammed,
        )
        return {
          handle: k.handle,
          displayName: k.displayName ?? k.handle,
          rugCount: k.rugCount ?? 0,
          totalScammed: monetaryValue(etat, k.totalScammed),
          totalScammedState: etat,
          status: k.status,
          verified: k.verified,
          // Les compteurs comptent CE QUI EST SERVI. Un compteur qui annoncerait
          // 482 à côté de 179 lignes affichées contredirait la liste posée juste
          // en dessous, et le lecteur croirait à un défaut d'affichage.
          walletCount: wallets.filter((w) => w.kolHandle === k.handle).length,
          caseCount: cases.filter((c) => c.kolHandle === k.handle).length,
        }
      }),
      wallets,
      cases,
      projectMap,
      connections,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
