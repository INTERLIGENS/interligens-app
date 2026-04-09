export const metadata = { title: "Politique de confidentialité — INTERLIGENS" };

export default function PrivacyPolicyFR() {
  const updated = "Avril 2026";
  const email = "admin@interligens.com";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">JURIDIQUE</div>
          <h1 className="text-3xl font-bold text-white mb-2">Politique de confidentialité</h1>
          <p className="text-zinc-500 text-sm">Dernière mise à jour : {updated}</p>
        </div>

        <Section title="1. Qui sommes-nous">
          <p>
            INTERLIGENS est une plateforme d&apos;intelligence blockchain. Cette politique explique
            comment nous collectons, utilisons et protégeons les informations lorsque vous accédez
            à notre plateforme.
          </p>
          <p>
            Contact :{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
            </a>
          </p>
        </Section>

        <Section title="2. Informations collectées">
          <h3 className="text-sm font-semibold text-zinc-300 mt-2">Données de compte et d&apos;accès</h3>
          <p>
            Lors de l&apos;accès à la plateforme beta, nous collectons les informations fournies
            lors de l&apos;onboarding, y compris votre adresse email et l&apos;acceptation du NDA.
            Des identifiants de session sont stockés via des cookies sécurisés.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Données d&apos;utilisation</h3>
          <p>
            Nous collectons des données d&apos;utilisation standard : pages visitées, requêtes
            de scan, horodatages, type de navigateur et informations sur l&apos;appareil. Ces
            données sont utilisées pour l&apos;exploitation, la sécurité et l&apos;amélioration
            du service.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Requêtes de scan</h3>
          <p>
            Lorsque vous effectuez un scan, l&apos;adresse blockchain ou l&apos;identifiant de
            token soumis est traité pour générer des résultats analytiques. Les requêtes peuvent
            être journalisées à des fins de sécurité et de prévention des abus.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Demandes de correction</h3>
          <p>
            Si vous soumettez une demande de correction, les informations fournies (y compris
            coordonnées et preuves) sont collectées et stockées pour le traitement de votre demande.
          </p>
        </Section>

        <Section title="3. Utilisation des informations">
          <p>Nous utilisons les informations collectées pour :</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Fournir, exploiter et maintenir la plateforme.</li>
            <li>Authentifier l&apos;accès et appliquer les contrôles d&apos;accès beta.</li>
            <li>Traiter les requêtes de scan et générer des résultats analytiques.</li>
            <li>Surveiller les menaces de sécurité, les abus et les accès non autorisés.</li>
            <li>Traiter les demandes de correction et les demandes juridiques.</li>
            <li>Améliorer la précision, la fiabilité et l&apos;expérience utilisateur.</li>
            <li>Se conformer aux obligations légales.</li>
          </ul>
          <p>
            Nous ne vendons, ne louons et ne cédons pas vos informations personnelles à des tiers
            à des fins marketing.
          </p>
        </Section>

        <Section title="4. Cookies et sessions">
          <p>
            La plateforme utilise des cookies essentiels pour gérer les sessions
            d&apos;authentification. Ces cookies sont strictement nécessaires au fonctionnement
            de la plateforme. Nous n&apos;utilisons pas de cookies publicitaires tiers.
          </p>
        </Section>

        <Section title="5. Conservation des données">
          <p>
            Les données de compte sont conservées pendant la durée de l&apos;accès beta et pour
            une période raisonnable après. Les journaux d&apos;utilisation sont conservés jusqu&apos;à
            12 mois. Les dossiers de correction sont conservés indéfiniment dans le cadre de
            l&apos;intégrité éditoriale.
          </p>
          <p>
            Vous pouvez demander la suppression de vos données personnelles en contactant{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
            </a>
            . Les demandes sont traitées sous 30 jours, sous réserve des obligations légales de
            conservation.
          </p>
        </Section>

        <Section title="6. Prestataires tiers">
          <p>Nous utilisons les services tiers suivants :</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li><strong className="text-zinc-300">Fournisseurs d&apos;hébergement cloud</strong> — Infrastructure et déploiement (États-Unis).</li>
            <li><strong className="text-zinc-300">Fournisseurs de bases de données</strong> — Services de bases de données gérées (États-Unis / UE).</li>
            <li><strong className="text-zinc-300">Fournisseurs de services IA</strong> — Traitement analytique (États-Unis). Aucune donnée personnelle n&apos;est partagée au-delà du contexte de la requête analytique.</li>
          </ul>
        </Section>

        <Section title="7. Sécurité des données">
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour
            protéger vos informations. Celles-ci incluent des connexions chiffrées (TLS), des
            contrôles d&apos;accès et une gestion des sessions. Aucun système n&apos;est
            parfaitement sécurisé.
          </p>
        </Section>

        <Section title="8. Vos droits">
          <p>Selon votre juridiction, vous pouvez avoir le droit de :</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Accéder aux données personnelles que nous détenons.</li>
            <li>Demander la correction de données inexactes.</li>
            <li>Demander la suppression de vos données personnelles.</li>
            <li>Vous opposer à certains types de traitement ou les restreindre.</li>
            <li>Demander la portabilité des données lorsque techniquement faisable.</li>
          </ul>
          <p>
            Pour exercer ces droits :{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
            </a>
            . Réponse sous 30 jours.
          </p>
        </Section>

        <Section title="9. Transferts internationaux">
          <p>
            Vos données peuvent être traitées aux États-Unis et dans d&apos;autres juridictions.
            En utilisant la plateforme, vous consentez au transfert et au traitement de vos données
            dans ces juridictions.
          </p>
        </Section>

        <Section title="10. Mineurs">
          <p>
            La plateforme n&apos;est pas destinée aux personnes de moins de 18 ans. Nous ne
            collectons pas sciemment d&apos;informations personnelles de mineurs.
          </p>
        </Section>

        <Section title="11. Langue">
          <p>
            Cette politique est rédigée en anglais. En cas d&apos;incohérence entre la version
            anglaise et la présente traduction, la version anglaise prévaut.
          </p>
        </Section>

        <Section title="12. Modifications">
          <p>
            Nous pouvons mettre à jour cette politique. Les modifications prennent effet dès leur
            publication.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Pour toute question :{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
            </a>
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
      <a href="/fr/demo" className="text-[#F85B05] hover:text-white text-sm transition-colors">&larr; Retour</a>
      <a href="/fr/legal/terms" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Conditions</a>
      <a href="/fr/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Avertissement</a>
      <a href="/fr/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction</a>
    </div>
  );
}
