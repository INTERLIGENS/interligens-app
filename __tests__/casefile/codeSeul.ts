/**
 * __tests__/casefile/codeSeul.ts
 *
 * UNE MENTION N'EST PAS UNE ÉMISSION.
 *
 * ██  Une garde dont le signal survit à sa propre correction ne signale  ██
 * ██  plus rien : son vert et son rouge cessent tous deux de vouloir     ██
 * ██  dire quelque chose.                                                ██
 *
 * ─── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────
 *
 * Le motif a mordu QUATRE fois dans ce dépôt, sous quatre formes :
 *
 *   1. `caseDb.ts:124` compté IMPRIMEUR pour une ligne de JOURNAL
 *      (`porteurs-artefact-univers.test.ts` — corrigé en exigeant du balisage) ;
 *   2. `resolveCaseFileRef` compté EXPOSÉ pour une mention en PROSE, alors que
 *      la route ne fait que NOMMER le symbole dans le commentaire qui justifie
 *      la forme de son refus (`rc-resolveur-citation.test.ts`) ;
 *   3. les trois routes CORRIGÉES de la fenêtre S3 comptées encore PORTEUSES,
 *      à cause des commentaires expliquant POURQUOI elles ne le sont plus ;
 *   4. le dépouillement LUI-MÊME, écrit ligne à ligne, qui laisse passer trois
 *      formes de prose — mesurées ci-dessous.
 *
 * Les occurrences 2 et 3 ont la MÊME cause, et ce n'est ni « codeSeul ne
 * retire pas les commentaires » ni « codeSeul n'est pas appelé » : avant le
 * correctif, AUCUN dépouillement n'existait sur ces deux chemins. La détection
 * lisait la source BRUTE — `git grep -l` d'un côté, le fichier entier de
 * l'autre. Le dépouillement a été introduit en même temps que le correctif.
 *
 * ─── CE QUE LE DÉPOUILLEMENT LIGNE À LIGNE LAISSE PASSER ──────────────────
 *
 * L'idiome historique du dépôt (`e1-e2-wiring.test.ts:17`) retire les lignes
 * dont le premier caractère non blanc est `//`, `*` ou `/*`. Trois formes de
 * prose y échappent, et chacune suffit à ressusciter le faux positif :
 *
 *     const x = dossier.ref;  // ancien : case_meta.case_id
 *     ^^^^^^^^^^^^^^^^^^^^^^^^^^ commentaire de FIN DE LIGNE
 *
 *     /* on n'émet plus
 *        case_meta.case_id ici       <- INTÉRIEUR de bloc sans `*` en tête
 *     *\/
 *
 *     const note = "ne plus émettre case_meta.case_id";   <- CHAÎNE
 *
 * Ce module lit le code comme un analyseur, pas comme une suite de lignes :
 * il traverse les chaînes, les gabarits et les littéraux de motif sans jamais
 * y entrer en mode commentaire. Les sauts de ligne SURVIVENT au dépouillement —
 * plusieurs critères du dépôt sont sensibles à la ligne (`[^\n]*`), et un
 * dépouillement qui recolle les lignes fabriquerait des coïncidences.
 *
 * ⚠️ LA CHAÎNE N'EST PAS DÉPOUILLÉE, ET C'EST DÉLIBÉRÉ. Une chaîne est du
 * CODE : c'est par elle que passent les gabarits, les en-têtes HTTP et les
 * clefs d'archive. La retirer rendrait les gardes aveugles à l'émission même
 * qu'elles défendent. Le mode de défaillance choisi est donc TOUJOURS le même :
 * en cas de doute, on GARDE le texte — on ne l'efface jamais. Une garde qui
 * garde trop crie à tort ; une garde qui efface trop se tait à tort.
 *
 * Critère : __tests__/casefile/mention-vs-emission.test.ts
 */

/** Caractères après lesquels un `/` est une DIVISION, jamais un début de motif. */
const AVANT_DIVISION = /[A-Za-z0-9_$)\]`'"<>]/;

/**
 * Le code seul — commentaires de ligne ET de bloc retirés, partout où ils sont,
 * y compris en fin de ligne et à l'intérieur d'un bloc sans `*` en tête.
 *
 * Les sauts de ligne sont préservés : la sortie a exactement autant de lignes
 * que l'entrée, et chaque ligne de sortie est une sous-suite de son entrée.
 */
export function codeSeul(src: string): string {
  let res = "";
  let etat: "code" | "ligne" | "bloc" | "texte" | "motif" = "code";
  let delim = "";
  let classe = false; // dans un `[…]` de littéral de motif
  let precedent = ""; // dernier caractère de CODE non blanc

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const d = src[i + 1] ?? "";

    if (etat === "ligne") {
      if (c === "\n") {
        etat = "code";
        res += c;
      }
      continue;
    }

    if (etat === "bloc") {
      if (c === "*" && d === "/") {
        etat = "code";
        i++;
      } else if (c === "\n") {
        res += c; // la ligne survit, son contenu non
      }
      continue;
    }

    if (etat === "texte") {
      res += c;
      if (c === "\\") {
        res += d;
        i++;
        continue;
      }
      if (c === delim) etat = "code";
      continue;
    }

    if (etat === "motif") {
      res += c;
      if (c === "\\") {
        res += d;
        i++;
        continue;
      }
      if (c === "[") classe = true;
      else if (c === "]") classe = false;
      else if (c === "/" && !classe) {
        etat = "code";
        precedent = "/";
      } else if (c === "\n") {
        // Un littéral de motif ne franchit pas la ligne : si on en est là,
        // c'était une division mal lue. On revient au code sans rien effacer.
        etat = "code";
      }
      continue;
    }

    // ── état « code » ──
    if (c === "/" && d === "/") {
      etat = "ligne";
      i++;
      continue;
    }
    if (c === "/" && d === "*") {
      etat = "bloc";
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      etat = "texte";
      delim = c;
      res += c;
      precedent = c;
      continue;
    }
    if (c === "/" && (precedent === "" || !AVANT_DIVISION.test(precedent))) {
      etat = "motif";
      classe = false;
      res += c;
      continue;
    }
    res += c;
    if (!/\s/.test(c)) precedent = c;
  }

  return res;
}

/**
 * LE CRITÈRE. « Ce symbole est-il ÉMIS par le code ? » — et non « le fichier
 * le mentionne-t-il quelque part ? ».
 *
 * Ratifié : *a semantic enforcement guard must inspect executable semantics,
 * not textual mention of the prohibited mechanism.* Une garde qui interroge
 * la source BRUTE sanctionne le commentaire qui explique le correctif, c'est-
 * à-dire exactement la prose que le correctif a rendue nécessaire.
 *
 * `.match()` plutôt que `.test()` : un littéral de motif porteur du drapeau
 * `g` garde un `lastIndex`, et deux appels successifs ne rendraient pas la
 * même réponse. Un critère ne se souvient pas de la question précédente.
 *
 * Critère du critère : __tests__/garde/semantique-executable.test.ts
 */
export function emisParLeCode(src: string, symbole: string | RegExp): boolean {
  const code = codeSeul(src);
  return typeof symbole === "string"
    ? code.includes(symbole)
    : code.match(symbole) !== null;
}

/**
 * Le dépouillement HISTORIQUE, ligne à ligne. Conservé parce qu'il est le
 * TÉMOIN : les mutants de `mention-vs-emission.test.ts` montrent ce qu'il
 * laisse passer, et c'est cette démonstration qui justifie le remplacement.
 */
export function codeSeulLigneALigne(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}
