export const metadata = {
  title: "Doctrine Données KOL | INTERLIGENS",
  description:
    "Comment INTERLIGENS collecte et traite les données publiques des Key Opinion Leaders crypto pour l'intelligence anti-fraude.",
};

export default function KolDataDoctrineFR() {
  const updated = "Mai 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">
            JURIDIQUE · DOCTRINE DONNÉES
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Doctrine Données KOL — Comment INTERLIGENS traite les données des acteurs publics
          </h1>
          <p className="text-zinc-500 text-sm">Dernière mise à jour : {updated}</p>
        </div>

        <Section title="A. Objet et base légale">
          <p>
            INTERLIGENS collecte et traite des données publiquement accessibles
            concernant les Key Opinion Leaders (KOL) crypto à la seule fin
            d&apos;intelligence anti-fraude et de protection des investisseurs
            particuliers.
          </p>
          <p>
            Base légale : intérêt légitime à lutter contre la fraude financière
            (RGPD Art. 6(1)(f)), intérêt public, et exemption journalistique /
            recherche le cas échéant.
          </p>
        </Section>

        <Section title="B. Sources de données">
          <p>
            Toutes les données proviennent exclusivement de sources publiques :
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Transactions blockchain publiques (les données on-chain sont publiques
              par nature)
            </li>
            <li>
              Publications publiques sur les réseaux sociaux (X / Twitter, canaux
              Telegram publics)
            </li>
            <li>Déploiements de smart contracts publics</li>
            <li>Rapports d&apos;investigation publiés par des tiers</li>
          </ul>
          <p>
            INTERLIGENS n&apos;utilise <strong className="text-white">pas</strong> de
            données privées, piratées, leakées, ni aucune donnée obtenue par accès
            non autorisé.
          </p>
        </Section>

        <Section title="C. Minimisation des données">
          <p>
            Seules les données directement pertinentes pour l&apos;évaluation du
            risque de fraude crypto sont collectées.
          </p>
          <p>L&apos;identité civile n&apos;est pas publiée, sauf si :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>La personne a publiquement révélé son identité, ou</li>
            <li>
              Une autorité judiciaire l&apos;a identifiée en lien avec une fraude.
            </li>
          </ul>
          <p>
            Pseudo ≠ identité civile. Les pseudos de réseaux sociaux ne sont pas
            traités comme une identification personnelle, sauf auto-divulgation.
          </p>
        </Section>

        <Section title="D. Ce que nous publions">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Adresses de wallets publiques liées à des patterns de risque documentés
            </li>
            <li>Historique de promotion de tokens (posts publics)</li>
            <li>Analyse de transactions on-chain (données blockchain publiques)</li>
            <li>Scoring de risque basé sur des signaux documentés</li>
          </ul>
          <p>
            Nous employons des formulations telles que &laquo; risque critique
            documenté &raquo; — jamais &laquo; coupable &raquo; ou &laquo; criminel
            &raquo;, sauf décision judiciaire officielle.
          </p>
        </Section>

        <Section title="E. Ce que nous ne publions pas">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Adresses personnelles, numéros de téléphone, identités des proches
            </li>
            <li>Communications privées</li>
            <li>Allégations non vérifiées sans preuve on-chain</li>
            <li>Affirmations absolues de culpabilité ou de criminalité</li>
          </ul>
        </Section>

        <Section title="F. Droit de rectification">
          <p>
            Toute personne référencée dans le Registre KOL INTERLIGENS peut demander
            la revue de son profil.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Contact :{" "}
              <a
                href="mailto:admin@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                admin@interligens.com
              </a>
            </li>
            <li>
              Les demandes sont examinées sous 30 jours ouvrés.
            </li>
            <li>
              En cas d&apos;erreur factuelle identifiée, les corrections sont
              appliquées rapidement.
            </li>
            <li>
              Les demandes de retrait sont évaluées au cas par cas, en mettant en
              balance les droits de la personne et l&apos;intérêt public à la
              prévention de la fraude.
            </li>
          </ul>
        </Section>

        <Section title="G. Traçabilité et intégrité des preuves">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Toutes les données du Registre KOL sont horodatées et attribuées à
              leur source.
            </li>
            <li>
              Les captures de preuves sont archivées avec hash SHA-256 pour
              vérification d&apos;intégrité.
            </li>
            <li>
              Aucune donnée n&apos;est fabriquée, interpolée ou hallucinée par IA.
              Chaque affirmation repose sur une preuve publique vérifiable.
            </li>
          </ul>
        </Section>

        <Section title="H. Conservation des données">
          <p>
            Les profils KOL sont conservés tant que les signaux de risque associés
            restent pertinents.
          </p>
          <p>
            Les profils peuvent être archivés (et non supprimés) lorsque les signaux
            de risque ne sont plus actifs, afin de préserver l&apos;historique pour
            les investigations en cours ou futures.
          </p>
        </Section>

        <Section title="I. Contact">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Demandes données :{" "}
              <a
                href="mailto:admin@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                admin@interligens.com
              </a>
            </li>
            <li>
              Demandes de retrait :{" "}
              <a
                href="mailto:takedown@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                takedown@interligens.com
              </a>
            </li>
          </ul>
          <p className="text-zinc-500 italic">
            &laquo; Fondé sur la preuve. Pas un conseil financier. &raquo;
          </p>
        </Section>

        <Footer />
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Footer() {
  return (
    <div className="pt-6 border-t border-zinc-800 flex flex-wrap items-center gap-6">
      <a
        href="/fr/demo"
        className="text-[#F85B05] hover:text-white text-sm transition-colors"
      >
        &larr; Retour
      </a>
      <a
        href="/fr/legal/disclaimer"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Avertissement
      </a>
      <a
        href="/fr/legal/privacy"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Confidentialité
      </a>
      <a
        href="/fr/legal/terms"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Conditions
      </a>
      <a
        href="/fr/correction"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Correction
      </a>
      <a
        href="/en/legal/kol-data-doctrine"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        EN
      </a>
    </div>
  );
}
