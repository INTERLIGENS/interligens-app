// ─── SURFACE EXPLORER — LE RÉSUMÉ NE SE REMPLACE PAS, IL DISPARAÎT ───────
//
// ██  LA CLÉ PART POUR LES QUATORZE. AUCUNE PRÉSENCE À COMPARER.          ██
//
// ─── CE QUE CE FICHIER A CRU, ET POURQUOI C'ÉTAIT FAUX ──────────────────
//
// Il portait `RESUME_NON_GOUVERNE`, une chaîne unique servie à la place des
// treize résumés sans fondation :
//
//   « Summary withheld — no publication decision covers this content. »
//
// Le raisonnement était celui-ci, et il paraissait solide : les quatorze
// dossiers portent un `summary`, donc supprimer la CLÉ pour treize et la
// garder pour un créerait un différentiel de PRÉSENCE que rien n'avait avant.
// Une chaîne identique n'en crée aucun — même clé, même position, treize
// indistinguables entre eux.
//
// LA PRÉMISSE ÉTAIT BONNE. LA CONCLUSION NE L'ÉTAIT PAS.
//
// Mesuré sur la charge servie : treize dossiers annoncent un retrait, un porte
// un vrai résumé. La partition 13/1 n'est pas effacée, elle est rendue
// EXPLICITE — et le texte AFFIRME qu'un contenu existe et a été retenu. C'est
// un voile négatif concluant, déjà fermé en P0 sous une autre forme (S3-1).
//
//   « Ne créez aucun substitut UX. Pas de badge Under review, pas de N/A, pas
//     de [redacted], pas de texte expliquant qu'une information a été retirée.
//     Sinon nous recréons potentiellement un différentiel sur L'EXISTENCE de
//     l'information. »
//
// La sortie du différentiel de présence n'est pas un texte de remplacement.
// C'est de retirer la clé POUR LES QUATORZE — exactement le geste appliqué
// aux huit. Aucune clé, aucune présence à comparer, aucune assertion sur
// l'existence de quoi que ce soit.
//
// ─── CE QUI CESSE D'ÊTRE SERVI, ET CE QUI NE L'ÉTAIT DÉJÀ PLUS ──────────
//
// Les neuf `summary` de type « launch » venaient de `KolTokenLink.note`, lu à
// UN SEUL endroit du dépôt — donc fermer ce chemin le fermait partout. Ce
// qu'ils portaient, mesuré :
//
//   TOESCOIN  « Auto-draft from Watcher V2 bridge. Internal review pending —
//               not public, not legal-reviewed. »
//   BOTIFY    « Dad wallet received full supply allocation and dumped. »
//   SERIAL    « … aucune CA attestée en base, reste non résolu (ne pas
//               deviner). »                         ← instruction au développeur
//   OVPP      « CEO = Parth Kapadia … conflict-of-interest flag »
//   BULLISH   `{"firstPromotionAt":"…","seededFrom":"bullish_seed_2026-05-14"}`
//
// Rien de tout cela n'était servi après le containment : la chaîne de refus
// avait bien pris leur place. Ce lot ne ferme donc pas une fuite de CONTENU —
// il ferme l'assertion d'EXISTENCE que la chaîne de refus portait elle-même.
//
// ─── POURQUOI CE MODULE N'EXPORTE PLUS RIEN ─────────────────────────────
//
// `RESUME_NON_GOUVERNE` et `resumeGouverne` sont retirés. Il ne reste aucune
// décision de surface à prendre sur le résumé : un champ qui n'est pas émis
// n'a pas de forme de refus, et une fonction qui choisirait laquelle serait
// une invitation à le réémettre.
//
// Le fichier subsiste pour porter CE raisonnement — pas pour porter du code.
// La garde exécutable est ailleurs et elle est positive :
// __tests__/governance/p0-explorer-pas-de-substitut.test.ts

export {};
