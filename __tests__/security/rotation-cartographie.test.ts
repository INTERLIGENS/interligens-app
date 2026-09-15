/**
 * L'instrument de cartographie de rotation, éprouvé sur ses quatre règles de
 * forme. Chaque test rejoue un phénomène RÉEL de l'incident du 2026-09-15,
 * avec des valeurs inertes :
 *
 *   - la ligne sans `=` qu'aucun parseur dotenv ne charge et qui est pourtant
 *     partie verbatim en production ;
 *   - la `DATABASE_URL` pooler/direct, dont la comparaison de chaînes rend un
 *     FAUX NÉGATIF sur le mot de passe de la base de production ;
 *   - la case qu'on n'a pas mesurée et qui doit valoir INCONNU, jamais « non » ;
 *   - le rapport qui ne doit contenir aucune valeur — vérifié par le crible,
 *     pas par l'intention.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  cartographier,
  chercherFuite,
  creerBac,
  decomposerValeur,
  effacerBac,
  empreinte,
  extraireOctets,
  indexer,
  nouveauNonce,
  autoritePour,
  rendre,
  estDiscriminante,
  LONGUEUR_MIN_FUITE,
} from "../../scripts/rotation/cartographie-vercel.mjs";

// Valeurs inertes, jamais des secrets réels. Le suffixe « -inerte » garantit
// qu'aucune de ces chaînes ne peut coïncider avec une valeur de production.
const LIGNE_NUE = "AAAABBBBCCCCDDDDEEEEFFFF-jeton-bearer-inerte";
const MDP = "motdepasse-inerte-9f2a";

const EXPOSE = Buffer.from(
  [
    "# fichier parti en production",
    "",
    `DATABASE_URL=postgresql://neondb_owner:${MDP}@ep-square-band-12345-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`,
    `DATABASE_URL_UNPOOLED=postgresql://neondb_owner:${MDP}@ep-square-band-12345.eu-central-1.aws.neon.tech/neondb`,
    "ADMIN_TOKEN=jeton-admin-inerte-0001",
    "ETHERSCAN_API_KEY=cle-etherscan-inerte-0002",
    LIGNE_NUE, // ← la ligne 6 : aucun `=`, aucun nom, et pourtant expédiée
    'RESEND_API_KEY="cle-resend-inerte-0003"',
    "ADMIN_TOKEN=jeton-admin-inerte-0001",
  ].join("\n"),
  "utf8",
);

const POSTE = Buffer.from(
  [
    `DATABASE_URL=postgresql://neondb_owner:${MDP}@ep-square-band-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require`,
    "ADMIN_TOKEN=jeton-admin-inerte-0001",
    `X_BEARER_TOKEN=${LIGNE_NUE}`,
    "RESEND_API_KEY=cle-resend-inerte-NOUVELLE",
    "R2_EVIDENCE_ACCESS_KEY_ID=cle-evidence-creee-apres-incident",
    "KV_URL=redis://default:jeton-kv-inerte-0006@kv.example.com:6379",
  ].join("\n"),
  "utf8",
);

describe("extraction depuis les octets", () => {
  it("compte les affectations, les commentaires et les lignes vides", () => {
    const e = extraireOctets(EXPOSE);
    expect(e.compteurs.commentaires).toBe(1);
    expect(e.compteurs.vides).toBe(1);
    expect(e.compteurs.affectations).toBe(6);
  });

  it("compte et signale la ligne sans `=` — sans jamais l'imprimer", () => {
    const e = extraireOctets(EXPOSE);
    expect(e.compteurs.nonConformes).toBe(1);
    const nc = e.nonConformes[0];
    expect(nc.ligne).toBe(7);
    expect(nc.motif).toBe("sans-egal");
    expect(nc.octets).toBe(LIGNE_NUE.length);
    // La structure ne porte le contenu que sous forme d'octets destinés à
    // l'empreinte. Aucun champ imprimable ne le recopie.
    const imprimables = JSON.stringify({ ligne: nc.ligne, octets: nc.octets, motif: nc.motif });
    expect(imprimables).not.toContain(LIGNE_NUE);
  });

  it("un parseur dotenv aurait manqué cette ligne : elle n'est dans aucun nom", () => {
    const noms = [...indexer(extraireOctets(EXPOSE)).keys()];
    expect(noms).not.toContain(LIGNE_NUE);
    expect(noms).toEqual(["DATABASE_URL", "DATABASE_URL_UNPOOLED", "ADMIN_TOKEN", "ETHERSCAN_API_KEY", "RESEND_API_KEY"]);
  });

  it("déguillemète pour la comparaison mais garde les octets bruts", () => {
    const a = indexer(extraireOctets(EXPOSE)).get("RESEND_API_KEY")!;
    expect(a.guillemets).toBe(true);
    expect(a.normale.toString()).toBe("cle-resend-inerte-0003");
    expect(a.brut.toString()).toBe('"cle-resend-inerte-0003"');
  });

  it("signale une variable redéfinie deux fois dans le même fichier", () => {
    const e = extraireOctets(EXPOSE);
    const redefinies = e.affectations.filter((a) => a.redefinie).map((a) => a.nom);
    expect(redefinies).toEqual(["ADMIN_TOKEN"]);
  });
});

describe("empreinte salée", () => {
  it("la même valeur donne la même empreinte sous le même nonce", () => {
    const n = nouveauNonce();
    expect(empreinte(n, Buffer.from("abc"))).toBe(empreinte(n, Buffer.from("abc")));
  });

  it("deux exécutions ne sont pas comparables", () => {
    expect(empreinte(nouveauNonce(), Buffer.from("abc"))).not.toBe(empreinte(nouveauNonce(), Buffer.from("abc")));
  });

  it("distingue absent, vide et non vide", () => {
    const n = nouveauNonce();
    expect(empreinte(n, null)).toBeNull();
    expect(empreinte(n, Buffer.from(""))).toBe("#vide");
    expect(empreinte(n, Buffer.from("x"))).toMatch(/^#[0-9a-f]{12}$/);
  });

  it("l'empreinte ne contient rien de la valeur", () => {
    const fp = empreinte(nouveauNonce(), Buffer.from(LIGNE_NUE));
    expect(fp).not.toContain(LIGNE_NUE.slice(0, 8));
    expect(fp!.length).toBe(13);
  });
});

describe("variantes déguisées", () => {
  it("pooler et direct : la chaîne diffère, le mot de passe est le MÊME", () => {
    const expose = indexer(extraireOctets(EXPOSE)).get("DATABASE_URL")!.normale.toString();
    const poste = indexer(extraireOctets(POSTE)).get("DATABASE_URL")!.normale.toString();
    expect(expose).not.toBe(poste); // le faux négatif de la comparaison de chaînes

    const n = nouveauNonce();
    const a = decomposerValeur(expose)!;
    const b = decomposerValeur(poste)!;
    expect(a.composants.variante).toBe("POOLER");
    expect(b.composants.variante).toBe("DIRECT");
    expect(empreinte(n, a.composants.hote)).not.toBe(empreinte(n, b.composants.hote));

    // Ce que la décomposition rétablit :
    expect(empreinte(n, a.composants.motDePasse)).toBe(empreinte(n, b.composants.motDePasse));
    expect(empreinte(n, a.composants.utilisateur)).toBe(empreinte(n, b.composants.utilisateur));
    expect(empreinte(n, a.composants.endpointBase)).toBe(empreinte(n, b.composants.endpointBase));
    expect(a.composants.endpointBase).toBe("ep-square-band-12345");
  });

  it("l'hôte est exclu des composants signifiants — c'est lui qui mentait", () => {
    const d = decomposerValeur(`postgresql://u:${MDP}@h.example.com/db`)!;
    expect(d.composantsSensibles).not.toContain("hote");
    expect(d.composantsSensibles).toContain("motDePasse");
  });

  it("extrait la clé intégrée d'une URL RPC", () => {
    const d = decomposerValeur("https://mainnet.helius-rpc.com/?api-key=cle-inerte-0004")!;
    expect(d.type).toBe("url-porteuse-de-cle");
    expect((d.clesIntegrees as Record<string, string>)["api-key"]).toBe("cle-inerte-0004");
  });

  it("ne décompose pas ce qui n'est pas une URL", () => {
    expect(decomposerValeur("jeton-admin-inerte-0001")).toBeNull();
    expect(decomposerValeur("https://interligens.com/page")).toBeNull();
  });
});

describe("cartographie", () => {
  const n = nouveauNonce();
  const carte = cartographier({
    nonce: n,
    expose: extraireOctets(EXPOSE),
    poste: extraireOctets(POSTE),
    vercel: null,
    conso: null,
  });
  const ligne = (nom: string) => carte.lignes.find((l) => l.nom === nom)!;

  it("rattache la ligne nue au credential vivant qu'elle porte", () => {
    expect(carte.orphelines).toHaveLength(1);
    expect(carte.orphelines[0].correspond).toContain("X_BEARER_TOKEN (poste)");
  });

  it("déclare exposé un credential qui n'a jamais porté de nom dans le fichier", () => {
    expect(ligne("X_BEARER_TOKEN").exposition).toBe("EXPOSÉ (ligne sans nom de variable)");
  });

  it("ne déclare pas exposé ce qui est seulement actif", () => {
    // Le credential Evidence a été créé APRÈS l'incident : actif ≠ exposé.
    expect(ligne("R2_EVIDENCE_ACCESS_KEY_ID").exposition).toBe("non exposé");
  });

  it("établit sans Vercel que l'exposé est encore la valeur vivante du poste", () => {
    expect(ligne("ADMIN_TOKEN").colIdentiquePoste).toContain("IDENTIQUE");
    expect(ligne("RESEND_API_KEY").colIdentiquePoste).toBe("différente");
    expect(ligne("ETHERSCAN_API_KEY").colIdentiquePoste).toBe("absente du poste");
  });

  it("ne prononce aucun verdict sur un composant à source unique", () => {
    // `KV_URL` n'existe que sur le poste : il n'y a rien à comparer, et écrire
    // « identique » serait un verdict inventé.
    const v = carte.variantes.find((x) => x.nom === "KV_URL")!;
    expect(v.avecExpose).toBe(false);
    expect(v.rangs.every((r) => r.identique === null)).toBe(true);
  });

  it("une case non mesurée vaut INCONNU, jamais « non »", () => {
    expect(ligne("ADMIN_TOKEN").colVercel).toBe("INCONNU");
    expect(ligne("ADMIN_TOKEN").colIdentique).toContain("INCONNU");
    expect(ligne("ADMIN_TOKEN").colConso).toBe("INCONNU");
  });

  it("signale la redéfinition dans la colonne alias", () => {
    expect(ligne("ADMIN_TOKEN").colAlias).toContain("redéfinie deux fois");
  });

  it("remonte le verdict par composant jusqu'à la ligne — sinon DATABASE_URL reste 🟠", () => {
    // La chaîne diffère (pooler contre direct). Le mot de passe, non. Si la
    // ligne disait « différente », le credential le plus grave serait classé
    // non urgent.
    expect(ligne("DATABASE_URL").colIdentiquePoste).toContain("IDENTIQUE par composant");
    expect(ligne("DATABASE_URL").colIdentiquePoste).toContain("motDePasse");
  });

  it("attrape le secret transversal : parti sous un nom, vivant sous un autre", () => {
    // `DATABASE_URL_UNPOOLED` n'existe pas sur le poste. Son mot de passe
    // exposé y est pourtant vivant — sous le nom `DATABASE_URL`. Une
    // comparaison nom à nom l'aurait déclaré éteint.
    const t = carte.transversaux.find((x) => x.nom === "DATABASE_URL_UNPOOLED")!;
    expect(t).toBeDefined();
    expect(t.trouves[0].composant).toBe("motDePasse");
    expect(t.trouves[0].vivantSous).toContain("DATABASE_URL.motDePasse (poste)");
    expect(ligne("DATABASE_URL_UNPOOLED").colIdentiquePoste).toContain("IDENTIQUE par composant");
  });

  it("compare composant par composant la DATABASE_URL", () => {
    const v = carte.variantes.find((x) => x.nom === "DATABASE_URL")!;
    const mdp = v.rangs.find((r) => r.composant === "motDePasse")!;
    expect(mdp.identique).toBe(true); // ⚠️ le mot de passe exposé est vivant
  });
});

describe("autorités de révocation", () => {
  it("un secret émis par nous emprunte la branche de démonstration", () => {
    expect(autoritePour("ADMIN_TOKEN").branche).toBe("demonstration");
  });

  it("une clé tierce emprunte la branche d'invalidation", () => {
    expect(autoritePour("RESEND_API_KEY").branche).toBe("invalidation");
    expect(autoritePour("RESEND_API_KEY").reecrireSuffit).toBe(false);
  });

  it("un cookie de session ne se rote pas en le réécrivant", () => {
    const a = autoritePour("X_CT0_1");
    expect(a.reecrireSuffit).toBe(false);
    expect(a.geste).toContain("TERMINER LES SESSIONS");
  });

  it("un sel n'est pas une clé", () => {
    expect(autoritePour("VAULT_AUDIT_SALT").branche).toBe("sans-objet");
    expect(autoritePour("VAULT_AUDIT_SALT").geste).toContain("NE PAS ROTER");
  });

  it("un nom inconnu reste INCONNU et dit ce qu'il faut pour trancher", () => {
    const a = autoritePour("UNE_VARIABLE_JAMAIS_VUE");
    expect(a.autorite).toBe("INCONNU");
    expect(a.geste).toContain("Ce qu'il faut pour trancher");
  });
});

describe("crible anti-fuite", () => {
  it("attrape une valeur recopiée dans le rapport", () => {
    const fautes = chercherFuite(`… ${LIGNE_NUE} …`, [{ etiquette: "X_BEARER_TOKEN", valeur: LIGNE_NUE }]);
    expect(fautes).toEqual(["X_BEARER_TOKEN"]);
  });

  it("ignore les valeurs trop courtes pour être discriminantes", () => {
    expect("true".length).toBeLessThan(LONGUEUR_MIN_FUITE);
    expect(chercherFuite("BILLING=true", [{ etiquette: "X", valeur: "true" }])).toEqual([]);
  });

  it("écarte les valeurs de la liste close — le cas qui a fait avorter la première exécution en vif", () => {
    // NODE_ENV=production dans un rapport intitulé « CARTOGRAPHIE VERCEL
    // PRODUCTION » : le crible avait raison sur la lettre, tort sur le fond.
    expect(estDiscriminante("production")).toBe(false);
    expect(chercherFuite("## CARTOGRAPHIE VERCEL production", [{ etiquette: "NODE_ENV", valeur: "production" }])).toEqual([]);
  });

  it("n'écarte pas un secret sous prétexte qu'il est court ou verbeux", () => {
    expect(estDiscriminante(MDP)).toBe(true); // 22 octets, chiffres et tirets
    expect(estDiscriminante("productionX")).toBe(true); // un caractère de plus, et c'est un secret
    expect(chercherFuite(`fuite: ${MDP}`, [{ etiquette: "DATABASE_URL", valeur: MDP }])).toEqual(["DATABASE_URL"]);
  });

  it("écarte les valeurs purement numériques", () => {
    expect(estDiscriminante("1234567890")).toBe(false);
  });

  it("le rapport rendu ne contient aucune valeur des sources", () => {
    const n = nouveauNonce();
    const expose = extraireOctets(EXPOSE);
    const poste = extraireOctets(POSTE);
    const carte = cartographier({ nonce: n, expose, poste, vercel: null, conso: null });
    const texte = rendre({
      carte,
      sources: [{ role: "test", chemin: "/dev/null", taille: "0", affectations: 0, nonConformes: 0 }],
      vercel: null,
      conso: null,
      horodatage: "2026-09-15T00:00:00Z",
      compteurs: { test: 1 },
    });

    const etiquetees = [
      ...carte.lignes.flatMap((l) => [
        l.valeurExposee && { etiquette: `${l.nom}/exposé`, valeur: l.valeurExposee },
        l.valeurPoste && { etiquette: `${l.nom}/poste`, valeur: l.valeurPoste },
      ]),
      ...carte.orphelines.map((o: { ligne: number; octetsBruts: Buffer }) => ({
        etiquette: `ligne ${o.ligne}`,
        valeur: o.octetsBruts,
      })),
    ].filter(Boolean) as { etiquette: string; valeur: Buffer | string }[];

    expect(etiquetees.length).toBeGreaterThan(5);
    expect(chercherFuite(texte, etiquetees)).toEqual([]);
    expect(texte).not.toContain(MDP);
    expect(texte).not.toContain(LIGNE_NUE);
    // Et il porte bien le critère de fermeture, mot pour mot (le rendu le
    // replie sur trois lignes de citation ; on en vérifie les trois fragments).
    expect(texte).toContain("For every credential materially exposed in retained deployment bytes");
    expect(texte).toContain("independently invalidated at its authority, or it has been demonstrated non-operational");
    expect(texte).toContain("local or deployment value alone does not close exposure");
  });
});

describe("bac temporaire", () => {
  it("est créé hors du dépôt, puis effacé par l'instrument lui-même", () => {
    const bac = creerBac();
    expect(bac.startsWith(process.cwd())).toBe(false);
    fs.writeFileSync(`${bac}/prod.env`, "SECRET=valeur-inerte-0005\n");
    expect(fs.existsSync(`${bac}/prod.env`)).toBe(true);

    const r = effacerBac(bac);
    expect(r.etat).toBe("supprimé");
    expect(fs.existsSync(bac)).toBe(false);
  });

  it("l'effacement d'un bac déjà disparu n'échoue pas", () => {
    expect(effacerBac("/tmp/bac-qui-n-existe-pas-00000").etat).toBe("supprimé");
  });
});
