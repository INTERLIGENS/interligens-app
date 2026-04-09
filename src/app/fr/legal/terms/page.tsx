export const metadata = { title: "Conditions d'utilisation — INTERLIGENS" };

export default function TermsOfUseFR() {
  const updated = "Avril 2026";
  const email = "admin@interligens.com";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">JURIDIQUE</div>
          <h1 className="text-3xl font-bold text-white mb-2">Conditions d&apos;utilisation</h1>
          <p className="text-zinc-500 text-sm">Dernière mise à jour : {updated}</p>
        </div>

        <Section title="1. Nature du service">
          <p>
            INTERLIGENS est une plateforme d&apos;intelligence blockchain qui fournit des analyses
            relatives à l&apos;activité on-chain, aux patterns de risque des tokens, aux comportements
            de wallets et à l&apos;activité publiquement observable. La plateforme produit des scores
            de risque, des rapports d&apos;investigation, des dossiers et des documents analytiques.
          </p>
          <p>
            Tous les résultats sont le produit de processus analytiques propriétaires appliqués
            à des données publiquement accessibles. Ils reflètent des patterns et des signaux observés
            — pas des certitudes. Ils ne constituent ni des accusations, ni des conclusions juridiques,
            ni des conseils financiers ou d&apos;investissement.
          </p>
        </Section>

        <Section title="2. Accès beta privé">
          <p>
            L&apos;accès à INTERLIGENS est actuellement fourni sur une base beta privée, sur
            invitation uniquement. L&apos;accès est soumis à un Accord de Non-Divulgation (NDA)
            signé lors de l&apos;onboarding. La plateforme, ses fonctionnalités, ses résultats et
            sa disponibilité peuvent changer, être mis à jour ou interrompus à tout moment sans
            préavis.
          </p>
          <p>
            L&apos;accès beta ne crée aucun droit d&apos;accès continu, aucune attente de continuité,
            ni aucune obligation de la part d&apos;INTERLIGENS. INTERLIGENS se réserve le droit de
            révoquer, suspendre ou modifier l&apos;accès à sa seule discrétion, sans motif et sans
            responsabilité.
          </p>
        </Section>

        <Section title="3. Utilisation autorisée">
          <p>Vous pouvez utiliser la plateforme pour :</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Effectuer des vérifications sur des adresses blockchain, des tokens et l&apos;activité on-chain associée.</li>
            <li>Consulter les résultats analytiques, scores de risque et documents d&apos;investigation à titre informatif.</li>
            <li>Partager les résultats de scan et rapports avec des destinataires identifiés à des fins personnelles ou de conformité, sous réserve du NDA.</li>
          </ul>
        </Section>

        <Section title="4. Utilisation interdite">
          <p>Vous ne pouvez pas :</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Redistribuer, revendre, republier publiquement ou exploiter commercialement les données, rapports ou résultats de la plateforme sans autorisation écrite préalable.</li>
            <li>Utiliser les résultats pour harceler, diffamer, menacer ou cibler un individu ou une entité.</li>
            <li>Tenter de rétro-ingénierer, décompiler, extraire, scraper ou répliquer tout aspect de la plateforme, y compris ses méthodes analytiques, sa logique de scoring, ses systèmes de détection ou ses processus propriétaires.</li>
            <li>Utiliser des outils automatisés, bots, scripts ou toute méthode d&apos;accès non humaine.</li>
            <li>Présenter les résultats comme des conclusions juridiques, des déterminations réglementaires, des accusations ou des conseils financiers.</li>
            <li>Contourner, désactiver ou interférer avec toute fonctionnalité de sécurité ou de contrôle d&apos;accès.</li>
            <li>Utiliser la plateforme à toute fin contraire à la loi applicable.</li>
          </ul>
        </Section>

        <Section title="5. Résultats analytiques — aucune garantie">
          <p>
            Les résultats d&apos;INTERLIGENS sont de nature analytique. Ils sont basés sur les
            données disponibles au moment de l&apos;analyse et reflètent des patterns et signaux
            observés — pas des certitudes, pas des accusations, et pas des conclusions de fait ou
            de droit.
          </p>
          <p>
            La plateforme ne garantit pas l&apos;exactitude, l&apos;exhaustivité, la ponctualité
            ou la fiabilité d&apos;un quelconque résultat. Les scores de risque peuvent changer.
            L&apos;absence de signal de risque ne certifie pas la sécurité. La présence d&apos;un
            signal de risque ne constitue pas une preuve de fraude ou d&apos;intention malveillante.
          </p>
          <p>
            Les utilisateurs sont seuls responsables de leurs décisions et actions basées sur les
            résultats de la plateforme. INTERLIGENS ne fournit en aucun cas de conseil financier,
            juridique ou d&apos;investissement.
          </p>
        </Section>

        <Section title="6. Limitation de responsabilité">
          <p>
            Dans la mesure maximale permise par la loi applicable, INTERLIGENS, ses opérateurs,
            dirigeants, affiliés, employés et contributeurs ne sauraient être tenus responsables
            de tout dommage direct, indirect, accessoire, spécial, consécutif ou punitif résultant
            de ou lié à votre utilisation de la plateforme, toute action prise sur la base des
            résultats, ou toute erreur ou interruption du service.
          </p>
          <p>
            La plateforme est fournie « en l&apos;état » et « selon disponibilité » sans garantie
            d&apos;aucune sorte. INTERLIGENS décline expressément toute garantie implicite.
          </p>
        </Section>

        <Section title="7. Indemnisation">
          <p>
            Vous acceptez d&apos;indemniser et de dégager de toute responsabilité INTERLIGENS,
            ses opérateurs, dirigeants, affiliés et employés contre toute réclamation, responsabilité,
            dommage, perte, coût ou dépense résultant de votre utilisation de la plateforme ou de
            votre violation de ces conditions.
          </p>
        </Section>

        <Section title="8. Propriété intellectuelle">
          <p>
            Tous les contenus, structures de données, méthodes analytiques, systèmes de scoring,
            systèmes de détection, cadres d&apos;investigation, rapports, designs et logiciels
            composant la plateforme INTERLIGENS sont la propriété exclusive d&apos;INTERLIGENS ou
            de ses concédants de licence. La nature propriétaire de ces systèmes est un actif
            essentiel d&apos;INTERLIGENS.
          </p>
          <p>
            Aucune licence, droit ou intérêt dans la propriété intellectuelle d&apos;INTERLIGENS
            n&apos;est accordé du fait de l&apos;accès à la plateforme, sauf le droit limité,
            révocable, non exclusif et non transférable d&apos;utiliser les résultats aux fins
            autorisées décrites dans les présentes.
          </p>
        </Section>

        <Section title="9. Processus de correction">
          <p>
            INTERLIGENS maintient un processus formel de correction. Si vous estimez qu&apos;une
            information publiée est factuellement inexacte ou mal attribuée, vous pouvez soumettre
            une demande via notre page{" "}
            <a href="/fr/correction" className="text-[#F85B05] hover:text-white transition-colors">
              Processus de correction
            </a>.
          </p>
          <p>
            Les demandes sont examinées sur la base de leurs mérites et preuves. INTERLIGENS se
            réserve le droit absolu d&apos;accepter, rejeter ou partiellement mettre en œuvre toute
            correction à sa seule discrétion.
          </p>
        </Section>

        <Section title="10. Suspension et résiliation">
          <p>
            INTERLIGENS peut suspendre ou résilier votre accès à tout moment, pour tout motif,
            sans préavis et sans responsabilité. À la résiliation, tous les droits qui vous sont
            accordés cessent immédiatement. Les obligations qui survivent par nature (confidentialité,
            limitation de responsabilité, indemnisation, propriété intellectuelle) restent en vigueur.
          </p>
        </Section>

        <Section title="11. Disponibilité du service">
          <p>
            INTERLIGENS ne garantit pas un accès ininterrompu, continu ou sans erreur. Le service
            peut être temporairement indisponible. Aucune responsabilité ne découle des interruptions
            de service.
          </p>
        </Section>

        <Section title="12. Langue">
          <p>
            Ces conditions sont rédigées en anglais. En cas d&apos;incohérence entre la version
            anglaise et toute traduction, la version anglaise prévaut.
          </p>
        </Section>

        <Section title="13. Droit applicable">
          <p>
            Ces conditions sont régies par les lois de l&apos;État du Delaware, États-Unis. Tout
            litige est soumis à la compétence exclusive des tribunaux du Delaware.
          </p>
        </Section>

        <Section title="14. Modifications">
          <p>
            INTERLIGENS se réserve le droit de modifier ces conditions à tout moment. Les
            modifications prennent effet dès leur publication. L&apos;utilisation continue de la
            plateforme vaut acceptation des conditions mises à jour.
          </p>
        </Section>

        <Section title="15. Contact">
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
      <a href="/fr/legal/privacy" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Confidentialité</a>
      <a href="/fr/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Avertissement</a>
      <a href="/fr/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction</a>
    </div>
  );
}
