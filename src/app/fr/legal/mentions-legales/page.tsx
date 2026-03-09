export default function MentionsLegalesFR() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Mentions légales</h1>
          <p className="text-gray-400 text-sm">Dernière mise à jour : mars 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Éditeur du site</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Ce site est édité par INTERLIGENS.<br />
            Contact : <a href="mailto:contact@interligens.com" className="text-orange-400 hover:text-orange-300">contact@interligens.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Hébergement</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Ce site est hébergé par Vercel Inc., 340 Pine Street, Suite 701, San Francisco,
            CA 94104, États-Unis. Site web : vercel.com
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Propriété intellectuelle</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            L'ensemble des contenus de ce site (textes, graphiques, logos, données) est la
            propriété exclusive d'INTERLIGENS, sauf mention contraire. Toute reproduction ou
            diffusion sans accord écrit préalable est strictement interdite.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Données personnelles</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Ce site ne collecte pas de données personnelles à des fins commerciales. Les adresses
            blockchain analysées sont des données publiques disponibles sur les réseaux décentralisés.
            Pour toute question relative à vos données, contactez-nous à l'adresse ci-dessus.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Droit applicable</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Le présent site est soumis au droit français. Tout litige relatif à son utilisation
            sera soumis à la compétence exclusive des tribunaux français.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <a href="/fr" className="text-orange-400 hover:text-orange-300 text-sm transition">← Retour à l'accueil</a>
        </div>
      </div>
    </main>
  );
}
