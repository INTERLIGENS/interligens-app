// ─── CC-OFFLINE-244 · CF-3 — L'ARTEFACT GOUVERNÉ ───────────────────────────
//
// ██  UN RENDERER PRÉSENTE DES AUTORITÉS.                                  ██
// ██  IL NE FABRIQUE PAS UNE AUTORITÉ PAR CALCUL LOCAL.                    ██
//
// Il reçoit UNIQUEMENT la projection COUNSEL_INVESTOR de CF-2, et il n'a aucun
// moyen d'aller chercher autre chose : pas de base, pas de `loadCaseByMint`,
// pas de `summary` de secours, pas de `any`, pas de score.
//
// ─── CE QU'IL PEUT, ET CE QU'IL NE PEUT PAS ───────────────────────────────
//
//   PEUT      ordonner · mettre en page · formater · rendre lisible
//   NE PEUT PAS  classer · inférer · scorer · compléter · réinterpréter ·
//                chercher une prose de secours
//
// La nuance tient dans « classer » : les sections ci-dessous ne sont PAS un
// jugement du renderer. Chacune est adossée à une AUTORITÉ PORTÉE PAR LA DONNÉE :
//
//   GOVERNED CONCLUSIONS    `rowNature === "INFERENCE"`
//   GOVERNED OBSERVATIONS   toute autre `rowNature` admise
//
// ─── CC-OFFLINE-260 · UNE FAUSSE CATÉGORIE A ÉTÉ SUPPRIMÉE ────────────────
//
// ██  PROVENANCE KIND ≠ CLAIM SEMANTICS.                                    ██
// ██  A MACHINE-MEASURED PIECE IS NOT A NEGATIVE FINDING.                    ██
//
// Il exista ici une troisième section, « What could not be established »,
// alimentée par un prédicat qui testait `provenanceKind === "MACHINE_MEASURED"`
// sur les pièces citées. Elle était FAUSSE, et BC-0 l'a prouvé au premier sujet
// qui la mettait à l'épreuve : l'unique observation BOTIFY — qui ÉTABLIT 262
// lignes d'événements — s'est rendue sous un titre affirmant qu'on n'avait rien
// pu établir. Le titre niait le paragraphe.
//
// La cause n'était pas un mauvais libellé mais une CONFUSION D'AUTORITÉS :
//
//   SOURCE / EVIDENCE   quelle pièce soutient l'assertion ?
//   CLAIM               qu'est-ce qui est AFFIRMÉ ?
//   PROVENANCE          comment, par qui, la pièce a-t-elle été produite ?
//
// `MACHINE_MEASURED` répond à la TROISIÈME question. La section prétendait en
// tirer une réponse à la DEUXIÈME. Sur VINE les deux coïncidaient — la mesure
// y était un constat négatif — et la coïncidence avait été prise pour une règle.
//
// ⛔ ELLE N'EST PAS REMPLACÉE PAR UNE AUTRE HEURISTIQUE. Pas de lecture du
//    titre, pas de `causes.length`, pas de `result` analysé, pas de compte de
//    pièces, pas de type de source, pas de branche par sujet. La catégorie est
//    NEUTRE : elle ne présuppose ni positif, ni négatif, ni établi, ni non
//    établi.
//
//        LE TEXTE GOUVERNÉ DE LA CLAIM PORTE CE QU'ELLE AFFIRME.
//        LA PROVENANCE PORTE L'ORIGINE DE LA PIÈCE.
//
// Le sens négatif de `VINE-MEASURE-01` ne disparaît pas : il n'a jamais été
// porté par `MACHINE_MEASURED`. Il est écrit dans le contenu gouverné de la
// claim, qui dit ce qui a été cherché, dans quel périmètre, et ce qui n'a pas
// été trouvé — et ce contenu est rendu intégralement.
//
// ⛔ Il n'y a PAS de section RELATION, et c'est délibéré : « relation » n'est
//    porté par aucune autorité du modèle. Une claim qui cite quatre pièces le
//    MONTRE — ses quatre pièces sont rendues — mais rien dans la donnée ne la
//    déclare « relation ». Fabriquer cette section serait classer.
//
// ─── DEUX NIVEAUX DE LECTURE ──────────────────────────────────────────────
//
//   LEVEL 1  ce que le dossier ÉTABLIT
//   LEVEL 2  POURQUOI il peut l'établir — identité, version, sceau, pièces,
//            localisateurs, instrument, dépendances
//
// Chaque assertion porte son Level 2. Le PDF n'est pas un dump de base : le
// niveau 2 est attaché à l'assertion qu'il fonde, pas rejeté en annexe.
//
// ⚠️ Le niveau 2 est rendu OUVERT, dans un bloc ordinaire. Un `<details>` aurait
// été naturel sur une page web — et catastrophique ici : un moteur d'impression
// le rend REPLIÉ, et la trace de fondement aurait disparu de l'artefact tout en
// restant présente dans la source. Un PDF est un document, pas une page.
//
// ─── VOCABULAIRE ──────────────────────────────────────────────────────────
//
// Autorisé : RFC 3161 timestamp · offline verification · archived certificate
// chain · persisted-object digest · governed evidence · foundation-eligible.
// ⛔ Jamais : eIDAS, qualified timestamp, court admissible, legally guaranteed.

import type { AudienceScopedCaseFile, ProjectedClaim } from "./audienceProjection";
import type { AssembledSource } from "./authorityAssembly";

/** Le même binaire que le générateur existant. Aucune nouvelle infrastructure. */
const CHROMIUM_URL =
  "https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev/chromium-v143.0.4-pack.x64.tar";

const esc = (v: string | null | undefined): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const court = (v: string | null | undefined, n = 16): string =>
  v ? `${esc(v.slice(0, n))}…` : "—";

/**
 * LE TITRE D'UNE ASSERTION. **UNE SEULE RÈGLE**, ici, utilisée partout.
 *
 * Le bloc de claim et la présentation d'une dépendance désignent la MÊME
 * assertion : si chacun choisissait son champ, le même objet porterait deux
 * noms dans le même document, et le lecteur ne pourrait plus faire la jointure.
 */
const titreDe = (c: ProjectedClaim): string => c.titleFr ?? c.title;

/**
 * CC-OFFLINE-306 · L'INDEX DE LA PROJECTION — `claimId@version` → l'assertion.
 *
 * ██  IL N'INDEXE QUE `projection.claims`. RIEN D'AUTRE N'EST ATTEIGNABLE.  ██
 *
 * C'est toute l'autorité de l'enrichissement : ce qu'une dépendance nomme, le
 * renderer le RETROUVE dans ce qu'il a déjà reçu — il ne va pas le chercher.
 * Pas de base, pas de table relationnelle, pas d'`actors[]`, pas de lecture
 * hors projection. Une cible que l'audience n'a pas admise n'est pas dans
 * l'index, et le rendu retombe alors sur la forme d'origine.
 */
type IndexProjection = ReadonlyMap<string, ProjectedClaim>;

const indexerProjection = (claims: readonly ProjectedClaim[]): IndexProjection =>
  new Map(claims.map((c) => [`${c.claimId}@${c.version ?? ""}`, c]));

/** LEVEL 2 — le fondement d'une assertion, attaché à elle. */
function traceDe(c: ProjectedClaim, index: IndexProjection): string {
  const pieces = c.citedSources
    .map(
      (s: AssembledSource) => `
      <li>
        <code>${esc(s.sourceId)}</code> · ${esc(s.provenanceKind)}
        ${s.declaredBy ? ` · declared by <code>${esc(s.declaredBy)}</code>` : ""}
        <br><span class="m">digest ${court(s.sha256, 24)} · captured ${esc(s.capturedAt) || "—"}</span>
        ${s.sourceLocator ? `<br><span class="m">locator ${esc(s.sourceLocator)}</span>` : ""}
      </li>`,
    )
    .join("");

  // ─── CC-OFFLINE-306 · LA RELATION DEVIENT LISIBLE ───────────────────────
  //
  // Avant, une dépendance se rendait `DERIVED_FROM → VINE-MEASURE-01 v1` : un
  // code et un identifiant. Pour comprendre le lien, le lecteur devait remonter
  // à une autre section et faire la jointure de tête.
  //
  // Ce qui est AJOUTÉ est le TITRE et la NATURE de la cible, tous deux lus
  // dans `projection.claims`. Ce sont des DONNÉES, pas une interprétation.
  //
  // ⛔ AUCUN MOT N'EST AJOUTÉ. Pas de « because », pas de « therefore », pas
  //    de « caused by », pas de « attributed to ». Le renderer ne tire aucune
  //    conclusion de plus qu'avant : il montre, à l'endroit où le lien est
  //    déclaré, CE QUE LE LIEN DÉSIGNE. La relation reste exactement celle que
  //    `dependency_kind` porte en base.
  //
  // FAIL-CLOSED : si `claimId@version` n'est pas dans la projection — cible
  // non admise pour cette audience, version dépinglée, dépendance orpheline —
  // on rend l'identifiant et la version SEULS, exactement comme avant. On
  // n'invente pas un titre, on ne cherche pas une version voisine, on ne va
  // rien lire ailleurs.
  const deps = c.dependencies
    .map((d) => {
      const cible = index.get(`${d.sourceClaimId}@${d.sourceVersion}`);
      if (!cible) {
        return `
      <li><code>${esc(d.kind)}</code> → <code>${esc(d.sourceClaimId)}</code> v${d.sourceVersion}</li>`;
      }
      return `
      <li><code>${esc(d.kind)}</code>
        <br>→ ${esc(titreDe(cible))}
        <br>→ <code>${esc(d.sourceClaimId)}</code> v${d.sourceVersion}
        <br>→ ${esc(cible.rowNature)}</li>`;
    })
    .join("");

  return `
    <div class="trace">
      <div class="trace-t">Foundation trace</div>
      <div class="m">claim <code>${esc(c.claimId)}</code> v${c.version ?? "—"} ·
        ${esc(c.rowNature)} · ${esc(c.state)} ·
        content digest ${court(c.contentHash, 24)}</div>
      ${pieces ? `<div class="lbl">Governed evidence</div><ul>${pieces}</ul>` : ""}
      ${deps ? `<div class="lbl">Consumed governed assertions</div><ul>${deps}</ul>` : ""}
      ${!pieces && !deps ? `<div class="m">No cited evidence and no consumed assertion.</div>` : ""}
    </div>`;
}

function claimBloc(c: ProjectedClaim, index: IndexProjection): string {
  return `
  <article class="claim">
    <h3>${esc(titreDe(c))}</h3>
    ${c.description ? `<p>${esc(c.descriptionFr ?? c.description)}</p>` : ""}
    ${traceDe(c, index)}
  </article>`;
}

function section(
  titre: string,
  sous: string,
  claims: readonly ProjectedClaim[],
  index: IndexProjection,
): string {
  // ⛔ Une section sans autorité N'APPARAÎT PAS. Elle n'est pas rendue vide,
  //    elle n'est pas rendue « non établie » : elle est absente.
  if (claims.length === 0) return "";
  return `
  <section>
    <h2>${esc(titre)}</h2>
    <p class="sub">${esc(sous)}</p>
    ${claims.map((c) => claimBloc(c, index)).join("")}
  </section>`;
}

/**
 * LE RENDU. PUR — aucune base, aucun réseau, aucune horloge autre que celle
 * qu'on lui passe.
 *
 * `generatedAt` est un PARAMÈTRE : un renderer qui lirait l'heure lui-même
 * rendrait deux artefacts différents pour la même autorité, et l'on ne pourrait
 * plus dire lequel fait foi.
 */
export function renderGovernedCaseFileHtml(
  projection: AudienceScopedCaseFile,
  generatedAt: string,
): string {
  // DEUX CATÉGORIES, ET UNE SEULE AUTORITÉ POUR LES DISTINGUER : `rowNature`,
  // qui est une classification GOUVERNÉE. Rien d'autre n'est consulté — ni la
  // provenance des pièces, ni leur nombre, ni le texte de la claim.
  const conclusions = projection.claims.filter((c) => c.rowNature === "INFERENCE");
  const observations = projection.claims.filter((c) => c.rowNature !== "INFERENCE");

  // CC-OFFLINE-306 — construit UNE fois, sur la seule projection reçue.
  const index = indexerProjection(projection.claims);

  const toutesPieces = new Map<string, AssembledSource>();
  for (const c of projection.claims) for (const s of c.citedSources) toutesPieces.set(s.sourceId, s);

  const pieces = [...toutesPieces.values()]
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    .map(
      (s) => `
      <tr>
        <td><code>${esc(s.sourceId)}</code></td>
        <td>${esc(s.provenanceKind)}</td>
        <td class="m">${court(s.sha256, 20)}</td>
        <td class="m">${esc(s.capturedAt) || "—"}</td>
        <td class="m">${esc(s.declaredBy) || "—"}</td>
      </tr>`,
    )
    .join("");

  // ⛔ AUCUN mot de synthèse. Si rien n'est admis, on le DIT comme une
  //    cardinalité — et c'est la seule phrase que le renderer produit lui-même.
  const vide =
    projection.claims.length === 0
      ? `<section><h2>No governed claim</h2>
           <p class="sub">The governed corpus of this case file contains no claim
           admissible under the ${esc(projection.audience)} authority at the time of
           rendering. No synthetic assessment is produced in its place.</p></section>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{background:#000;color:#fff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;
       font-size:11px;line-height:1.6;margin:0;padding:32px 36px}
  h1{font-size:20px;margin:0 0 4px;letter-spacing:.02em}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:#FF6B00;
     border-bottom:1px solid #27272a;padding-bottom:6px;margin:26px 0 8px}
  h3{font-size:12px;margin:14px 0 4px;color:#fff}
  /* CC-OFFLINE-266 — UN TITRE NE RESTE PAS SEUL AU BAS D'UNE PAGE.
     Un moteur d'impression peut couper juste apres un titre : le lecteur voit
     alors une rubrique sans contenu, et son contenu sans rubrique. La regle est
     GENERIQUE — elle vaut pour TOUT titre, sans nommer aucune section, aucune
     page, aucun sujet. page-break-after est l'alias historique, conserve pour
     les moteurs qui ne lisent pas encore break-after. */
  h1,h2,h3{break-after:avoid;page-break-after:avoid}
  p{margin:4px 0 8px;color:#d4d4d8}
  .sub{color:#71717a;font-size:10px;margin:0 0 10px}
  .m{color:#71717a;font-size:9.5px;font-family:ui-monospace,Menlo,monospace}
  .lbl{color:#a1a1aa;font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-top:6px}
  code{font-family:ui-monospace,Menlo,monospace;color:#fafafa}
  ul{margin:4px 0;padding-left:16px}li{margin:3px 0}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  td,th{border-bottom:1px solid #18181b;padding:4px 6px;text-align:left;vertical-align:top}
  th{color:#71717a;font-size:9px;text-transform:uppercase;letter-spacing:.1em}
  .trace{margin:6px 0;border-left:2px solid #27272a;padding:4px 0 4px 10px}
  .trace-t{color:#a1a1aa;font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
  .hdr{border-bottom:1px solid #27272a;padding-bottom:12px;margin-bottom:6px}
  </style></head><body>

  <div class="hdr">
    <h1>${esc(projection.subject.codename)} — ${esc(projection.subject.title)}</h1>
    <div class="m">${esc(projection.subject.ref)} · ${esc(projection.subject.ticker)} ·
      audience ${esc(projection.audience)} · ${esc(projection.state)} ·
      generated ${esc(generatedAt)}</div>
  </div>

  ${vide}
  ${section(
    "Governed observations",
    "Governed assertions classified as observations. Each is stated by its own governed text " +
      "and carries its foundation trace and cited evidence below it.",
    observations,
    index,
  )}
  ${section(
    "Governed conclusions",
    "Governed assertions classified as inferences, each consuming the governed assertions listed in its trace.",
    conclusions,
    index,
  )}

  ${
    pieces
      ? `<section><h2>Governed evidence</h2>
    <p class="sub">Every piece cited above, with its provenance qualification and persisted-object digest.</p>
    <table><tr><th>Source</th><th>Provenance</th><th>Digest</th><th>Captured</th><th>Declared by</th></tr>
    ${pieces}</table></section>`
      : ""
  }

  <section><h2>Audit information</h2>
    <p class="sub">This artifact presents governed authorities. It performs no computation of its
    own and derives no assessment. Each assertion above carries its foundation trace: claim identity and
    version, content digest, cited evidence with digests and locators, and the governed assertions
    it consumes. Absences are stated as absences.</p>
  </section>

  </body></html>`;
}

// ═══ LES OCTETS ═════════════════════════════════════════════════════════════

/**
 * HTML → octets PDF. Même moteur et même URL de binaire que le générateur
 * existant : aucune nouvelle infrastructure de rendu n'est introduite.
 *
 * Séparé du rendu HTML, qui reste PUR et testable sans navigateur — c'est ce qui
 * permet aux témoins de CF-3 de porter sur ce que le renderer PRODUIT, et non
 * sur un binaire.
 */
export async function renderGovernedCaseFilePdf(
  projection: AudienceScopedCaseFile,
  generatedAt: string,
): Promise<Uint8Array> {
  const html = renderGovernedCaseFileHtml(projection, generatedAt);
  const puppeteer = (await import("puppeteer-core")).default;
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_URL),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return (await page.pdf({ format: "A4", printBackground: true })) as Uint8Array;
  } finally {
    await browser.close();
  }
}
