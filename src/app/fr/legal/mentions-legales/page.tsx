export const metadata = { title: "Mentions légales — INTERLIGENS" };

export default function MentionsLegalesFR() {
  const updated = "Avril 2026";
  const email = "admin@interligens.com";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">JURIDIQUE</div>
          <h1 className="text-3xl font-bold text-white mb-2">Mentions légales</h1>
          <p className="text-zinc-500 text-sm">Dernière mise à jour : {updated}</p>
        </div>

        <Section title="Éditeur">
          <p>
            Cette plateforme est éditée et exploitée par INTERLIGENS.<br />
            Type d&apos;entité : Delaware C-Corp (États-Unis).<br />
            Contact :{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
            </a>
          </p>
        </Section>

        <Section title="Hébergement">
          <p>
            Vercel Inc., 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis.
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            Tous les contenus, structures de données, méthodes analytiques, systèmes de scoring,
            cadres d&apos;investigation, designs, rapports et logiciels composant la plateforme
            INTERLIGENS sont la propriété exclusive d&apos;INTERLIGENS ou de ses concédants.
          </p>
          <p>
            Toute reproduction, distribution, modification ou extraction sans autorisation écrite
            préalable est strictement interdite et peut donner lieu à des poursuites.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p>
            Pour savoir comment nous collectons et traitons les données personnelles, consultez
            notre{" "}
            <a href="/fr/legal/privacy" className="text-[#F85B05] hover:text-white transition-colors">
              Politique de confidentialité
            </a>.
          </p>
        </Section>

        <Section title="Droit applicable">
          <p>
            Cette plateforme et son utilisation sont régies par les lois de l&apos;État du
            Delaware, États-Unis. Tout litige est soumis à la compétence exclusive des tribunaux
            du Delaware.
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
      <a href="/fr/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Avertissement</a>
    </div>
  );
}
