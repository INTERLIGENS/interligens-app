export default function DisclaimerFR() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Avertissement</h1>
          <p className="text-gray-400 text-sm">Dernière mise à jour : mars 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">À titre informatif uniquement</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS est un outil d'intelligence blockchain conçu pour aider les utilisateurs
            à identifier des adresses de wallets et des tokens potentiellement risqués. Toutes les
            données, scores et analyses fournis par cette plateforme sont donnés à titre informatif
            uniquement et ne constituent pas un conseil financier, juridique ou d'investissement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Pas de conseil financier</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Aucun élément de cette plateforme ne doit être interprété comme une recommandation
            d'achat, de vente ou de conservation d'une cryptomonnaie ou d'un actif numérique.
            Les utilisateurs sont seuls responsables de leurs décisions d'investissement. Effectuez
            toujours vos propres recherches et consultez un conseiller financier qualifié avant
            toute décision financière.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Exactitude des informations</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Bien que nous nous efforcions de fournir des informations exactes et à jour, INTERLIGENS
            ne garantit pas l'exhaustivité, l'exactitude ou la fiabilité des données affichées.
            Les données blockchain sont par nature complexes et peuvent être sujettes à des erreurs,
            omissions ou retards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Limitation de responsabilité</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS et ses opérateurs ne sauraient être tenus responsables de tout dommage
            direct, indirect, accessoire ou consécutif résultant de l'utilisation ou de
            l'impossibilité d'utiliser cette plateforme ou ses données. L'utilisation de ce service
            se fait entièrement à vos propres risques.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Sources tierces</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS agrège des données provenant de diverses sources tierces. Nous ne
            contrôlons pas ces sources et ne sommes pas responsables de leur contenu, exactitude
            ou disponibilité.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <a href="/fr" className="text-orange-400 hover:text-orange-300 text-sm transition">← Retour à l'accueil</a>
        </div>
      </div>
    </main>
  );
}
