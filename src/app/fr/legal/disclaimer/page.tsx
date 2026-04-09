export const metadata = { title: "Avertissement — INTERLIGENS" };

export default function DisclaimerFR() {
  const updated = "Avril 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">JURIDIQUE</div>
          <h1 className="text-3xl font-bold text-white mb-2">Avertissement</h1>
          <p className="text-zinc-500 text-sm">Dernière mise à jour : {updated}</p>
        </div>

        <Section title="Résultats analytiques — pas un conseil">
          <p>
            INTERLIGENS est une plateforme d&apos;intelligence blockchain. Toutes les données,
            scores de risque, rapports, dossiers et résultats analytiques fournis par cette
            plateforme sont à titre informatif et analytique uniquement. Ils ne constituent ni
            un conseil financier, ni un conseil juridique, ni des recommandations
            d&apos;investissement, ni des accusations contre un individu ou une entité.
          </p>
          <p>
            Les résultats reflètent des patterns et signaux observés dans des données publiquement
            accessibles au moment de l&apos;analyse. Ce ne sont ni des garanties, ni des
            prédictions, ni des conclusions définitives, ni des accusations.
          </p>
        </Section>

        <Section title="Pas de conseil financier">
          <p>
            Aucun élément de cette plateforme ne doit être interprété comme une recommandation
            d&apos;achat, de vente ou de conservation d&apos;une cryptomonnaie ou d&apos;un actif
            numérique. Les utilisateurs sont seuls responsables de leurs décisions financières.
            Effectuez toujours vos propres recherches et consultez un professionnel qualifié.
          </p>
        </Section>

        <Section title="Exactitude et exhaustivité">
          <p>
            INTERLIGENS ne garantit pas l&apos;exactitude, l&apos;exhaustivité, la fiabilité ou
            la ponctualité de ses données ou résultats. Les données blockchain sont complexes,
            décentralisées et peuvent être sujettes à des erreurs, omissions, retards ou
            manipulations par des tiers.
          </p>
          <p>
            Les scores de risque peuvent changer. Un score faible ne garantit pas la sécurité.
            Un score élevé ne constitue pas une preuve de fraude ou d&apos;intention malveillante.
          </p>
        </Section>

        <Section title="Sources tierces">
          <p>
            INTERLIGENS traite des données provenant de sources tierces incluant des blockchains
            publiques, des réseaux sociaux et d&apos;autres systèmes publiquement accessibles.
            INTERLIGENS ne contrôle pas, n&apos;approuve pas et ne garantit pas l&apos;exactitude
            ou la disponibilité de ces sources.
          </p>
        </Section>

        <Section title="Limitation de responsabilité">
          <p>
            Dans la mesure maximale permise par la loi, INTERLIGENS, ses opérateurs, affiliés et
            contributeurs ne sauraient être tenus responsables de tout dommage direct, indirect,
            accessoire, spécial, consécutif ou punitif résultant de votre utilisation de la
            plateforme ou de l&apos;impossibilité d&apos;y accéder.
          </p>
          <p>
            La plateforme est fournie « en l&apos;état » et « selon disponibilité » sans garantie
            d&apos;aucune sorte.
          </p>
        </Section>

        <Section title="Processus de correction">
          <p>
            Si vous estimez qu&apos;une information est factuellement inexacte ou mal attribuée,
            vous pouvez soumettre une demande via notre{" "}
            <a href="/fr/correction" className="text-[#F85B05] hover:text-white transition-colors">
              Processus de correction
            </a>
            . Toutes les demandes sont examinées sur la base de leurs mérites et preuves.
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
      <a href="/fr/legal/privacy" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Confidentialité</a>
      <a href="/fr/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction</a>
    </div>
  );
}
